"ui";

var BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try {
        var txt = files.read(BANK_PATH);
        var arr = JSON.parse(txt);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

function saveBank(bank) {
    files.write(BANK_PATH, JSON.stringify(bank, null, 2));
}

function addQuestion(q, a) {
    var bank = loadBank();
    bank.push({ q: String(q), a: String(a), time: new Date().toISOString() });
    saveBank(bank);
}

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
        <button id="importText" text="粘贴文本导入题库" style="Widget.AppCompat.Button" marginTop="8" />
        <button id="viewAll" text="查看所有题库" style="Widget.AppCompat.Button" marginTop="8" />

        <text text="提示：在学习强企看到题目时，点悬浮窗输入关键词查找答案"
            textSize="12sp" textColor="#888888" marginTop="auto" gravity="center" paddingBottom="16" />
    </vertical>
);

ui.countText.setText(loadBank().length + " 道");

ui.startFloat.on("click", function () {
    engines.execScriptFile(files.path("./float_search.js"));
    toast("悬浮窗已开启");
});

ui.addManual.on("click", function () {
    var q = dialogs.rawInput("输入题目内容");
    if (!q) return;
    var a = dialogs.rawInput("输入答案");
    if (!a) return;
    addQuestion(q, a);
    ui.countText.setText(loadBank().length + " 道");
    toast("已保存");
});

ui.importText.on("click", function () {
    var txt = dialogs.rawInput("粘贴题目+答案文本");
    if (!txt) return;
    var lines = String(txt).split("\n");
    var added = 0;
    for (var i = 0; i < lines.length; i++) {
        var line = String(lines[i]).trim();
        if (line.length < 5) continue;
        var nextIdx = i + 1;
        if (nextIdx < lines.length) {
            var next = String(lines[nextIdx]).trim();
            if (next.length > 0 && next.length < 60 && /^[A-Da-d]$/.test(next)) {
                addQuestion(line, next);
                added++;
                i++;
                continue;
            }
        }
        addQuestion(line, "待确认");
        added++;
    }
    ui.countText.setText(loadBank().length + " 道");
    toast("导入了 " + added + " 道题");
});

ui.viewAll.on("click", function () {
    var bank = loadBank();
    var len = bank.length;
    if (len === 0) {
        toast("题库为空");
        return;
    }
    var text = "共 " + len + " 道题\n\n";
    var maxShow = Math.min(len, 50);
    for (var i = 0; i < maxShow; i++) {
        var q = String(bank[i].q || "");
        var a = String(bank[i].a || "");
        if (q.length > 35) q = q.substring(0, 35) + "...";
        text = text + (i + 1) + ". " + q + "\n";
        text = text + "   → " + a + "\n\n";
    }
    if (len > 50) {
        text = text + "... 还有 " + (len - 50) + " 道题未显示";
    }
    alert(text);
});
