var D = "/sdcard/123/";
var OUT = D + "题库.txt";
var DONE = D + "已采集.txt";

// 检测无障碍
if (!auto.service) {
    app.startActivity({ action: "android.settings.ACCESSIBILITY_SETTINGS" });
    sleep(1500);
    if (!auto.service) {
        alert("请开启 Auto.js 无障碍服务后重试");
        exit();
    }
}
sleep(500);

var SW = device.width;
var SH = device.height;
var TOP = SH * 0.12;
var BOT = SH * 0.80;

// 去重集合
var done = {};
if (files.exists(DONE)) {
    try {
        var arr = files.read(DONE).split("\n");
        for (var i = 0; i < arr.length; i++) {
            var item = arr[i].trim();
            if (item.length > 0) { done[item] = true; }
        }
    } catch (e) { }
}

// 指纹
function fid(s) {
    s = String(s || "");
    if (s.length < 5) { return ""; }
    return s.substring(0, 25).replace(/\s+/g, "");
}

// 题型
function gtype() {
    var ts = ["判断题", "单选题", "多选题", "填空题", "判断", "单选", "多选", "填空"];
    for (var i = 0; i < ts.length; i++) {
        var n = text(ts[i]).findOne(200);
        if (n) { return ts[i]; }
    }
    return "未知";
}

// 题目
function gq() {
    try {
        var all = className("android.widget.TextView").find();
        var best = "";
        for (var i = 0; i < all.length; i++) {
            var n = all[i];
            var t = String(n.text() || "");
            if (t.length < 8) { continue; }
            var b = n.bounds();
            if (b.top < TOP || b.top > BOT) { continue; }
            var skip = false;
            var shorts = ["判断", "单选", "多选", "填空", "正确", "错误", "纠错", "答题卡", "上一题", "下一题"];
            for (var j = 0; j < shorts.length; j++) {
                if (t.indexOf(shorts[j]) >= 0 && t.length < 15) { skip = true; break; }
            }
            if (skip) { continue; }
            if (/^[A-H]\.?$/.test(t.trim())) { continue; }
            if (t.indexOf("答题结果") >= 0) { continue; }
            if (t.indexOf("正确答案") >= 0) { continue; }
            if (/[\u4e00-\u9fff]/.test(t) && t.length > best.length) {
                best = t;
            }
        }
        return best;
    } catch (e) {
        return "";
    }
}

// 答案
function ga() {
    try {
        var all = className("android.widget.TextView").find();
        for (var i = 0; i < all.length; i++) {
            var t = String(all[i].text() || "");
            if (t.indexOf("正确答案") >= 0) {
                return t.split("\n")[0];
            }
        }
        return "";
    } catch (e) {
        return "";
    }
}

// 翻页
function nx() {
    try {
        var b = text("下一题").findOne(300);
        if (b && b.clickable()) { b.click(); return true; }
        return false;
    } catch (e) { return false; }
}

// 主循环
var cnt = 0;
var stale = 0;
var lastFid = "";
var run = true;

toast("开始采集，音量上键停止");
events.on("volume_up", function () {
    run = false;
    toast("已停止，采集 " + cnt + " 题");
    sleep(1000);
    exit();
});

sleep(2000);

while (run && cnt < 1600) {
    var q = gq();
    var f = fid(q);

    if (!q || !f) {
        stale = stale + 1;
        if (stale > 10) { toast("连续读不到题目，结束"); break; }
        sleep(500);
        continue;
    }

    if (f === lastFid) {
        stale = stale + 1;
        if (stale > 5) { toast("题目不再变化，结束"); break; }
        sleep(500);
        continue;
    }

    stale = 0;
    lastFid = f;

    if (done[f]) {
        nx();
        sleep(600);
        continue;
    }

    var type = gtype();
    var ans = ga();
    var entry = "[" + type + "] " + q + "\n" + ans + "\n\n";

    try {
        files.append(OUT, entry);
        files.append(DONE, f + "\n");
        done[f] = true;
        cnt = cnt + 1;
        toast(cnt + " / ~1505");
    } catch (e) {
        toast("写入失败: " + e);
        break;
    }

    nx();
    sleep(1000);
}

toast("完成！共采集 " + cnt + " 题");