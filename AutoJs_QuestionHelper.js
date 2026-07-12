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

function search(keyword) {
    var bank = loadBank();
    if (!keyword || keyword.length < 1) return [];
    var results = [];
    var kw = String(keyword).toLowerCase();
    for (var i = 0; i < bank.length; i++) {
        var item = bank[i];
        var q = String(item.q || "").toLowerCase();
        if (q.indexOf(kw) >= 0) {
            results.push(item);
        }
    }
    results.sort(function (a, b) {
        return String(a.q || "").length - String(b.q || "").length;
    });
    return results.slice(0, 15);
}

function addQuestion(q, a) {
    var bank = loadBank();
    bank.push({ q: String(q), a: String(a), time: new Date().toISOString() });
    saveBank(bank);
}

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

ui.countText.setText(loadBank().length + " 道");

ui.startFloat.on("click", function () {
    engines.execScriptFile(files.path("./float_search.js"));
    toast("悬浮窗已开启");
});

ui.addManual.on("click", function () {
    var q = dialogs.rawInput("输入题目内容");
    if (!q) return;
    var a = dialogs.rawInput("输入答案 (如 A / B)");
    if (!a) return;
    addQuestion(q, a);
    ui.countText.setText(loadBank().length + " 道");
    toast("已保存");
});

ui.importText.on("click", function () {
    var txt = dialogs.rawInput("粘贴题目+答案文本\n格式: 题一行 答案一行");
    if (!txt) return;
    var lines = String(txt).split("\n");
    var added = 0;
    for (var i = 0; i < lines.length - 1; i++) {
        var line = String(lines[i]).trim();
        var next = String(lines[i + 1]).trim();
        if (line.length > 5 && next.length > 0 && next.length < 50) {
            var isAnswer = /^[A-Da-d]$/.test(next) || /^答案/.test(next) || /^正确/.test(next) || /^[✓✔√]/.test(next);
            if (isAnswer) {
                var ans = next.replace(/^答案[：:]\s*/, "").replace(/^[✓✔√]\s*/, "");
                addQuestion(line, ans);
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

ui.viewAll.on("click", function () {
    var bank = loadBank();
    if (bank.length === 0) {
        toast("题库为空");
        return;
    }
    showPage(bank, 0);
});

function showPage(bank, start) {
    var pageSize = 12;
    var total = bank.length;
    var end = Math.min(start + pageSize, total);
    var pageNum = Math.floor(start / pageSize) + 1;
    var totalPages = Math.ceil(total / pageSize);

    var text = "共 " + total + " 道题  第 " + pageNum + "/" + totalPages + " 页\n\n";

    for (var i = start; i < end; i++) {
        var q = String(bank[i].q || "");
        var a = String(bank[i].a || "");
        if (q.length > 40) {
            q = q.substring(0, 40) + "...";
        }
        text = text + (i + 1) + ". " + q + "\n   → " + a + "\n\n";
    }

    var hasMore = end < total;
    if (hasMore) {
        var result = dialogs.confirm("题库", text);
        if (result) {
            showPage(bank, end);
        }
    } else {
        alert("题库", text);
    }
}
