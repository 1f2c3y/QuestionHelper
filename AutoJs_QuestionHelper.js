"ui";

var BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try {
        var raw = files.read(BANK_PATH);
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        // 清洗数据：把非字符串的 q/a 转成可读字符串
        for (var i = 0; i < arr.length; i++) {
            arr[i].q = val2str(arr[i].q);
            arr[i].a = val2str(arr[i].a);
        }
        return arr;
    } catch (e) {
        return [];
    }
}

function saveBank(bank) {
    files.write(BANK_PATH, JSON.stringify(bank, null, 2));
}

function val2str(v) {
    if (v === null || v === undefined) return "";
    var t = typeof v;
    if (t === "string") return v.trim();
    if (t === "number" || t === "boolean") return String(v);
    // 对象或数组
    if (v.q !== undefined && v.a !== undefined) return val2str(v.q);
    if (v.text !== undefined) return val2str(v.text);
    if (v.question !== undefined) return val2str(v.question);
    try { return JSON.stringify(v); } catch (e) { return "[无法解析]"; }
}

function addQuestion(q, a) {
    q = val2str(q);
    a = val2str(a);
    if (!q || q.length < 2) return false;
    var bank = loadBank();
    bank.push({ q: q, a: a || "待确认", time: new Date().toISOString() });
    saveBank(bank);
    return true;
}

var floatRunning = false;

ui.layout(
    <vertical padding="16" bg="#F5F5F5">
        <text text="答题助手" textSize="22sp" textStyle="bold" textColor="#333333" gravity="center" marginTop="30" />
        <text text="悬浮窗关键词搜索本地题库" textSize="13sp" textColor="#888888" gravity="center" marginBottom="20" />

        <card cardCornerRadius="12" cardElevation="2" marginBottom="12">
            <vertical padding="16">
                <text text="本地题库" textSize="15sp" textColor="#333333" />
                <text id="countText" text="加载中..." textSize="28sp" textStyle="bold" textColor="#333333" marginTop="4" />
            </vertical>
        </card>

        <button id="startFloat" text="开启悬浮窗搜索" style="Widget.AppCompat.Button.Colored" marginTop="8" />
        <button id="addManual" text="手动录入题目" style="Widget.AppCompat.Button" marginTop="8" />
        <button id="clearBank" text="清空题库" style="Widget.AppCompat.Button" marginTop="8" />
        <button id="viewAll" text="查看所有题库" style="Widget.AppCompat.Button" marginTop="8" />

        <text text="提示：在学习强企看到题目时，点悬浮窗输入关键词查找答案"
            textSize="12sp" textColor="#888888" marginTop="auto" gravity="center" paddingBottom="16" />
    </vertical>
);

// 初始化计数
try { ui.countText.setText(loadBank().length + " 道"); } catch (e) { }

// 开启悬浮窗
ui.startFloat.on("click", function () {
    if (floatRunning) {
        toast("悬浮窗已在运行");
        return;
    }
    try {
        var path = files.path("./float_search.js");
        if (!files.exists(path)) {
            toast("未找到 float_search.js，请放在同目录");
            return;
        }
        var eng = engines.execScriptFile(path);
        floatRunning = true;
        toast("悬浮窗已开启");
    } catch (e) {
        toast("启动失败: " + e);
    }
});

// 手动录入 - 空内容直接拒绝
ui.addManual.on("click", function () {
    var q = dialogs.rawInput("输入题目内容（不能为空）");
    if (!q || String(q).trim().length < 2) {
        if (q !== null && q !== undefined) toast("内容不能为空");
        return;
    }
    var a = dialogs.rawInput("输入答案");
    if (a === null || a === undefined) return;
    if (String(a).trim().length < 1) a = "待确认";
    var ok = addQuestion(q, a);
    if (ok) {
        ui.countText.setText(loadBank().length + " 道");
        toast("已保存");
    } else {
        toast("保存失败");
    }
});

// 清空题库
ui.clearBank.on("click", function () {
    dialogs.confirm("确认清空", "确定要清空所有题库吗？", function (ok) {
        if (ok) {
            saveBank([]);
            ui.countText.setText("0 道");
            toast("已清空");
        }
    });
});

// 查看所有
ui.viewAll.on("click", function () {
    var bank = loadBank();
    if (bank.length === 0) {
        toast("题库为空");
        return;
    }
    var msg = "共 " + bank.length + " 道题\n\n";
    for (var i = 0; i < bank.length; i++) {
        var q = val2str(bank[i].q);
        var a = val2str(bank[i].a);
        if (q.length > 40) q = q.substring(0, 40) + "...";
        if (a.length > 20) a = a.substring(0, 20) + "...";
        msg = msg + (i + 1) + ". " + q + "\n";
        msg = msg + "   → " + a + "\n\n";
    }
    alert(msg);
});
