// 学习强企 - 考试复习自动采集题库
// 使用方式：进入考试复习 → 停留在任一题目页面 → 运行本脚本
// 按音量上键停止

"auto";
auto.waitFor();
sleep(1000);

var DIR = "/sdcard/123/";
var OUT = DIR + "题库.txt";
var DONE = DIR + "已采集.txt";

// 加载已采集的题目去重
var doneSet = {};
if (files.exists(DONE)) {
    var lines = files.read(DONE).split("\n");
    for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l.length > 0) doneSet[l] = true;
    }
}

// 生成题目指纹（前25字符哈希）
function fingerprint(q) {
    q = String(q || "");
    if (q.length < 5) return "";
    return q.substring(0, 25).replace(/\s+/g, "");
}

// 获取题型
function getType() {
    if (text("判断题").exists()) return "判断";
    if (text("单选题").exists()) return "单选";
    if (text("多选题").exists()) return "多选";
    if (text("填空题").exists()) return "填空";
    return "未知";
}

// 获取题目文字：找最长的、包含中文的 TextView
function getQuestion() {
    var all = className("android.widget.TextView").find();
    var best = "";
    for (var i = 0; i < all.length; i++) {
        var t = String(all[i].text() || "");
        if (t.length < 8) continue;
        // 过滤已知的非题目文本
        if (t.indexOf("答题结果") >= 0) continue;
        if (t.indexOf("正确答案") >= 0) continue;
        if (t.indexOf("答案解析") >= 0) continue;
        if (t.indexOf("判断题") >= 0 && t.length < 15) continue;
        if (t.indexOf("单选题") >= 0 && t.length < 15) continue;
        if (t.indexOf("多选题") >= 0 && t.length < 15) continue;
        if (t.indexOf("纠错") >= 0 && t.length < 10) continue;
        if (t.indexOf("答题卡") >= 0 && t.length < 10) continue;
        if (t.indexOf("上一题") >= 0 && t.length < 10) continue;
        if (t.indexOf("下一题") >= 0 && t.length < 10) continue;
        if (t === "正确" || t === "错误") continue;
        if (t === "A" || t === "B" || t === "C" || t === "D") continue;
        // 包含中文且更长
        if (/[\u4e00-\u9fff]/.test(t) && t.length > best.length) {
            best = t;
        }
    }
    return best;
}

// 获取答案
function getAnswer() {
    var n = textStartsWith("正确答案").findOne(500);
    if (n) return String(n.text());
    return "";
}

// 点击下一题
function clickNext() {
    var btn = text("下一题").findOne(500);
    if (btn) {
        btn.click();
        return true;
    }
    return false;
}

// 等待页面加载（等待题目文字变化或超时）
function waitForChange(oldQ) {
    for (var i = 0; i < 40; i++) {
        sleep(200);
        var q = getQuestion();
        if (q && q !== oldQ) return true;
    }
    return false;
}

var count = 0;
var maxQ = 1600;
var stale = 0;
var lastFp = "";

toast("开始采集，按音量上键停止");

// 音量上键停止
var running = true;
events.on("volume_up", function () {
    running = false;
    toast("用户停止，已采集 " + count + " 题");
});

var firstRun = true;

while (running && count < maxQ) {
    if (!firstRun) {
        sleep(800);
    }
    firstRun = false;

    var q = getQuestion();
    var fp = fingerprint(q);

    if (!fp || !q) {
        stale++;
        if (stale > 5) {
            toast("连续5次读不到题目，可能已结束");
            break;
        }
        sleep(500);
        continue;
    }

    // 题目没变 = 可能到底了
    if (fp === lastFp) {
        stale++;
        if (stale > 3) {
            toast("题目不再变化，采集结束");
            break;
        }
        sleep(500);
        continue;
    }

    stale = 0;
    lastFp = fp;

    // 去重
    if (doneSet[fp]) {
        // 已采集过，直接翻
        clickNext();
        sleep(600);
        continue;
    }

    var type = getType();
    var answer = getAnswer();

    // 写入文件
    var line = "[" + type + "] " + q;
    var entry = line + "\n" + answer + "\n\n";
    files.append(OUT, entry);
    files.append(DONE, fp + "\n");
    doneSet[fp] = true;
    count++;

    toast(count + " / ?  已采集");

    clickNext();
}

toast("完成！共采集 " + count + " 题，保存在 " + OUT);
