// 学习强企 - 考试复习自动采集题库 v3
// 进入考试复习 → 停在任一题目页面 → 运行本脚本
// 按音量上键停止

var DIR = "/sdcard/123/";
var OUT = DIR + "题库.txt";
var DONE = DIR + "已采集.txt";

// --- 无障碍检测 ---
if (!auto.service) {
    app.startActivity({ action: "android.settings.ACCESSIBILITY_SETTINGS" });
    sleep(1500);
    if (!auto.service) {
        alert("请先在系统设置中开启 Auto.js 无障碍服务，然后重新运行");
        exit();
    }
}
sleep(500);

// --- 屏幕尺寸 ---
var SW = device.width;
var SH = device.height;
var topCut = SH * 0.12;   // 顶部状态栏+导航，不算题目区
var botCut = SH * 0.80;   // 底部工具栏，不算题目区

// --- 加载去重 ---
var doneSet = {};
if (files.exists(DONE)) {
    try {
        var lines = files.read(DONE).split("\n");
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i].trim();
            if (l.length > 0) doneSet[l] = true;
        }
    } catch (e) { }
}

function fp(q) {
    q = String(q || "");
    if (q.length < 5) return "";
    return q.substring(0, 25).replace(/\s+/g, "");
}

// --- 获取题型 ---
function getType() {
    try {
        // 用 textStartsWith 匹配 "判断题" / "单选题" / "多选题" / "填空题"
        // 但有些界面可能是 "判断" / "单选" 不带"题"字
        var types = ["判断题", "单选题", "多选题", "填空题", "判断", "单选", "多选", "填空"];
        for (var i = 0; i < types.length; i++) {
            var n = text(types[i]).findOne(200);
            if (n) {
                var t = types[i];
                if (t.indexOf("判断") === 0) return "判断";
                if (t.indexOf("单选") === 0) return "单选";
                if (t.indexOf("多选") === 0) return "多选";
                if (t.indexOf("填空") === 0) return "填空";
            }
        }
    } catch (e) { }
    return "未知";
}

// --- 自适应屏幕获取题目文字 ---
function getQuestion() {
    try {
        var all = className("android.widget.TextView").find();
        var best = "";
        for (var i = 0; i < all.length; i++) {
            var node = all[i];
            var t = String(node.text() || "");
            if (t.length < 8) continue;

            // 按屏幕位置过滤：题目在屏幕中上部
            var b = node.bounds();
            if (b.top < topCut || b.top > botCut) continue;

            // 过滤标签类文本
            if (/^(判断|单选|多选|填空)题?$/.test(t.trim())) continue;
            if (/^(正确|错误)$/.test(t.trim())) continue;
            if (/^[A-H]\.?$/.test(t.trim())) continue;
            if (t.indexOf("答题结果") >= 0) continue;
            if (t.indexOf("正确答案") >= 0) continue;
            if (t.indexOf("答案解析") >= 0) continue;
            if (t.indexOf("解析：") >= 0 && t.length < 30) continue;
            if (t.indexOf("纠错") >= 0 && t.length < 10) continue;
            if (t.indexOf("答题卡") >= 0 && t.length < 10) continue;
            if (t.indexOf("上一题") >= 0 && t.length < 10) continue;
            if (t.indexOf("下一题") >= 0 && t.length < 10) continue;

            // 必须包含中文
            if (!/[\u4e00-\u9fff]/.test(t)) continue;

            // 取最长的
            if (t.length > best.length) best = t;
        }
        return best;
    } catch (e) {
        return "";
    }
}

// --- 获取答案（兼容多种格式） ---
function getAnswer() {
    try {
        // "正确答案：B" / "正确答案: B" / "正确答案B" / 分开两行
        var all = className("android.widget.TextView").find();
        for (var i = 0; i < all.length; i++) {
            var t = String(all[i].text() || "");
            if (t.indexOf("正确答案") >= 0) {
                // 合并同一节点和下一个节点的内容
                // 常见格式: "正确答案：B" 或 "正确答案" + 下一行 "B"
                var ans = t.replace(/正确答案[:：]?\s*/, "").trim();
                if (ans.length > 0 && ans.length <= 50) {
                    // 如果有下一行（解析文字），只取第一行
                    ans = ans.split(/\n/)[0];
                    return "正确答案：" + ans;
                }
                // 单节点只有"正确答案"四个字，找下一个节点
                // 尝试下一个兄弟节点
                return t; // 先返回当前节点的内容
            }
        }
    } catch (e) { }
    return "";
}

// --- 点击下一题（带状态检测） ---
function clickNext() {
    try {
        var btn = text("下一题").findOne(300);
        if (!btn) return "no_button";
        if (!btn.clickable()) {
            // 可能到底了，按钮灰掉
            return "disabled";
        }
        btn.click();
        return "ok";
    } catch (e) {
        return "error";
    }
}

// --- 等待页面稳定 ---
function waitForStable(oldQ) {
    for (var i = 0; i < 50; i++) {
        sleep(150);
        try {
            var q = getQuestion();
            if (q && q !== oldQ && q.length > 5) return q;
        } catch (e) { }
    }
    return "";
}

var count = 0;
var maxQ = 1600;
var stale = 0;
var lastQ = "";
var lastFp = "";
var noNextCount = 0;

toast("开始采集，音量上键停止");

var running = true;
events.on("volume_up", function () {
    running = false;
    toast("已停止，采集 " + count + " 题");
    sleep(1000);
    exit();
});

// 初次等待页面渲染
sleep(2000);

while (running && count < maxQ) {
    // 读题
    var q = getQuestion();
    var qFp = fp(q);

    if (!q || !qFp) {
        stale++;
        if (stale > 10) {
            toast("连续读不到题目，可能已退出考试复习页面，结束");
            break;
        }
        sleep(500);
        continue;
    }

    // 题目没变
    if (qFp === lastFp) {
        stale++;
        var btn = text("下一题").findOne(200);
        if (btn && !btn.clickable()) {
            toast("已到最后一题（下一题按钮不可用）");
        } else if (stale > 5) {
            toast("题目不再变化，结束");
        } else {
            // 可能网络慢，再等等
            sleep(800);
        }
        if (stale > 5) break;
        continue;
    }

    stale = 0;
    lastQ = q;
    lastFp = qFp;

    // 去重
    if (doneSet[qFp]) {
        // 已采过，翻页
        var r = clickNext();
        if (r === "disabled" || r === "no_button") {
            noNextCount++;
            if (noNextCount > 3) { toast("无法翻页，结束"); break; }
        } else { noNextCount = 0; }
        sleep(600);
        continue;
    }

    // 采集
    var type = getType();
    var answer = getAnswer();

    var entry = "[" + type + "] " + q + "\n" + answer + "\n\n";

    try {
        files.append(OUT, entry);
        files.append(DONE, qFp + "\n");
        doneSet[qFp] = true;
        count++;
        toast(count + " / ~1505");
    } catch (e) {
        toast("写入失败：" + e);
        break;
    }

    // 翻页
    var r2 = clickNext();
    if (r2 === "disabled") {
        toast("下一题按钮已灰，可能已到底");
        sleep(500);
        continue; // 再试一轮，让 stale 检测判断
    }
    if (r2 === "no_button") {
        noNextCount++;
        if (noNextCount > 3) { toast("连续找不到下一题按钮，结束"); break; }
    } else {
        noNextCount = 0;
    }

    // 等新题加载
    var newQ = waitForStable(q);
    if (!newQ) {
        stale++;
    }
}

toast("完成！共采集 " + count + " 题 → " + OUT);
