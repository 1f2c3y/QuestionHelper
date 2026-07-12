// 学习强企 - 考试复习自动采集题库 v2
// 进入考试复习 → 停在任一题目页面 → 运行本脚本
// 按音量上键停止

var DIR = "/sdcard/123/";
var OUT = DIR + "题库.txt";
var DONE = DIR + "已采集.txt";

// 检测并确保无障碍服务已开启
if (!auto.service) {
    toast("请先开启无障碍服务");
    app.startActivity({
        action: "android.settings.ACCESSIBILITY_SETTINGS"
    });
    dialogs.confirm("请开启 Auto.js 无障碍服务后点确定", "提示");
    if (!auto.service) {
        alert("无障碍服务仍未开启，脚本退出");
        exit();
    }
}

sleep(500);

// 加载已采集
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

function fingerprint(q) {
    q = String(q || "");
    if (q.length < 5) return "";
    return q.substring(0, 25).replace(/\s+/g, "");
}

function getType() {
    try {
        if (text("判断题").exists()) return "判断";
        if (text("单选题").exists()) return "单选";
        if (text("多选题").exists()) return "多选";
        if (text("填空题").exists()) return "填空";
    } catch (e) { }
    return "未知";
}

function getQuestion() {
    try {
        var all = className("android.widget.TextView").find();
        var best = "";
        for (var i = 0; i < all.length; i++) {
            var t = String(all[i].text() || "");
            if (t.length < 8) continue;
            if (t.indexOf("答题结果") >= 0) continue;
            if (t.indexOf("正确答案") >= 0) continue;
            if (t.indexOf("答案解析") >= 0) continue;
            if (t.indexOf("判断题") >= 0 && t.length < 15) continue;
            if (t.indexOf("单选题") >= 0 && t.length < 15) continue;
            if (t.indexOf("多选题") >= 0 && t.length < 15) continue;
            if (t.indexOf("填空题") >= 0 && t.length < 15) continue;
            if (t.indexOf("纠错") >= 0 && t.length < 10) continue;
            if (t.indexOf("答题卡") >= 0 && t.length < 10) continue;
            if (t.indexOf("上一题") >= 0 && t.length < 10) continue;
            if (t.indexOf("下一题") >= 0 && t.length < 10) continue;
            if (t === "正确" || t === "错误") continue;
            if (t === "A" || t === "B" || t === "C" || t === "D") continue;
            if (/[\u4e00-\u9fff]/.test(t) && t.length > best.length) {
                best = t;
            }
        }
        return best;
    } catch (e) {
        return "";
    }
}

function getAnswer() {
    try {
        var n = textStartsWith("正确答案").findOne(500);
        if (n) return String(n.text());
    } catch (e) { }
    return "";
}

function clickNext() {
    try {
        var btn = text("下一题").findOne(500);
        if (btn) { btn.click(); return true; }
    } catch (e) { }
    return false;
}

var count = 0;
var maxQ = 1600;
var stale = 0;
var lastFp = "";

toast("开始采集，按音量上键停止");

var running = true;
events.on("volume_up", function () {
    running = false;
    toast("用户停止，已采集 " + count + " 题");
});

var firstRun = true;

while (running && count < maxQ) {
    if (!firstRun) sleep(700);
    firstRun = false;

    var q = getQuestion();
    var fp = fingerprint(q);

    if (!fp || !q) {
        stale++;
        if (stale > 8) { toast("连续读不到题目，结束"); break; }
        sleep(400);
        continue;
    }

    if (fp === lastFp) {
        stale++;
        if (stale > 4) { toast("题目不再变化，可能已到底"); break; }
        sleep(400);
        continue;
    }

    stale = 0;
    lastFp = fp;

    if (doneSet[fp]) {
        clickNext();
        sleep(500);
        continue;
    }

    var type = getType();
    var answer = getAnswer();

    var line = "[" + type + "] " + q;
    var entry = line + "\n" + answer + "\n\n";
    files.append(OUT, entry);
    files.append(DONE, fp + "\n");
    doneSet[fp] = true;
    count++;

    toast(count + " / 约1505  已采集");

    clickNext();
}

toast("完成！共采集 " + count + " 题");
