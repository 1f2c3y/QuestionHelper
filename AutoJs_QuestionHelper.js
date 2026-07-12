"ui";
// ========================================
// 答题助手 - Auto.js 悬浮窗搜索脚本
// 题库文件：/sdcard/答题助手题库.json
// ========================================

var BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try {
        var txt = files.read(BANK_PATH);
        return JSON.parse(txt);
    } catch (e) {
        return [];
    }
}

function saveBank(bank) {
    files.write(BANK_PATH, JSON.stringify(bank, null, 2));
}

function search(keyword) {
    var bank = loadBank();
    if (!keyword || keyword.length < 1) return [];
    var results = [];
    var kw = keyword.toLowerCase();
    for (var i = 0; i < bank.length; i++) {
        var item = bank[i];
        var q = (item.q || "").toLowerCase();
        if (q.indexOf(kw) >= 0) {
            results.push(item);
        }
    }
    results.sort(function (a, b) {
        return (a.q || "").length - (b.q || "").length;
    });
    return results.slice(0, 15);
}

function addQuestion(q, a) {
    var bank = loadBank();
    bank.push({ q: q, a: a, time: new Date().toISOString() });
    saveBank(bank);
}

// ===== 主界面 =====
ui.layout(
    <vertical padding="16" bg="#F5F5F5">
        <text text="答题助手" textSize="22sp" textStyle="bold" textColor="#1565C0" gravity="center" marginTop="30" />
        <text text="悬浮窗关键词搜索本地题库" textSize="13sp" textColor="#888888" gravity="center" marginBottom="20" />

        <card cardCornerRadius="12" cardElevation="2" marginBottom="12">
            <vertical padding="16">
                <text text="本地题库" textSize="15sp" textColor="#333333" />
                <text id="countText" text="计算中..." textSize="28sp" textStyle="bold" textColor="#1565C0" marginTop="4" />
            </vertical>
        </card>

        <button id="startFloat" text="开启悬浮窗搜索" style="Widget.AppCompat.Button.Colored" marginTop="8" />
        <button id="addManual" text="手动录入题目" style="Widget.AppCompat.Button" marginTop="8" />
        <button id="importText" text="粘贴文本导入题库" style="Widget.AppCompat.Button" marginTop="8" />
        <button id="viewAll" text="查看所有题库" style="Widget.AppCompat.Button" marginTop="8" />

        <text text="提示：在学习强企看到题目时，点悬浮窗输入关键词查找答案"
            textSize="12sp" textColor="#AAAAAA" marginTop="auto" gravity="center" paddingBottom="16" />
    </vertical>
);

// 刷新计数
ui.countText.setText(loadBank().length + " 道");

// 开启悬浮窗
ui.startFloat.on("click", function () {
    engines.execScriptFile(files.path("./float_search.js"));
    toast("悬浮窗已开启");
});

// 手动录入
ui.addManual.on("click", function () {
    var q = dialogs.rawInput("输入题目内容 (复制粘贴即可)");
    if (!q) return;
    var a = dialogs.rawInput("输入答案 (如 A / B / 正确)");
    if (!a) return;
    addQuestion(q, a);
    ui.countText.setText(loadBank().length + " 道");
    toast("已保存");
});

// 粘贴文本批量导入 (支持从错题本复制的文本)
ui.importText.on("click", function () {
    var txt = dialogs.rawInput("粘贴题目+答案文本\n格式: 每道题占两行 (题一行,答案一行)");
    if (!txt) return;
    var lines = txt.split("\n");
    var added = 0;
    for (var i = 0; i < lines.length - 1; i++) {
        var line = lines[i].trim();
        var next = lines[i + 1].trim();
        if (line.length > 5 && next.length > 0 && next.length < 50) {
            // 判断下一行是否为答案(短文本)
            var isAnswer = /^[A-Da-d]$/.test(next) || /^答案/.test(next) || /^正确/.test(next) || /^[✓✔√]/.test(next);
            if (isAnswer) {
                var ans = next.replace(/^答案[：:]\s*/, "").replace(/^[✓✔√]\s*/, "");
                addQuestion(line, ans);
                added++;
                i++; // 跳过答案行
            } else if (line.length > 10) {
                addQuestion(line, next);
                added++;
                i++;
            }
        } else if (line.length > 5 && !/^[A-Da-d]$/.test(line)) {
            addQuestion(line, "待确认");
            added++;
        }
    }
    ui.countText.setText(loadBank().length + " 道");
    toast("导入了 " + added + " 道题");
});

// 查看全部
ui.viewAll.on("click", function () {
    var bank = loadBank();
    if (bank.length === 0) {
        toast("题库为空");
        return;
    }
    var text = "";
    for (var i = 0; i < bank.length; i++) {
        var item = bank[i];
        text += (i + 1) + ". " + (item.q || "").substring(0, 50);
        if ((item.q || "").length > 50) text += "...";
        text += "\n   答案: " + (item.a || "") + "\n\n";
    }
    dialogs.build({
        title: "题库 (" + bank.length + " 道)",
        content: text,
        positive: "关闭"
    }).show();
});
