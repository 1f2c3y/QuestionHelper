"ui";
// ========================================
// 答题助手 - Auto.js 悬浮窗搜索脚本
// 题库文件：/sdcard/答题助手题库.json
// ========================================

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
    var q = dialogs.rawInput("输入题目内容");
    if (!q) return;
    var a = dialogs.rawInput("输入答案 (如 A / B)");
    if (!a) return;
    addQuestion(q, a);
    ui.countText.setText(loadBank().length + " 道");
    toast("已保存");
});

// 粘贴文本批量导入
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

// 查看全部 - 修复：使用alert避免dialogs.build的兼容问题
ui.viewAll.on("click", function () {
    var bank = loadBank();
    if (bank.length === 0) {
        toast("题库为空");
        return;
    }
    var count = bank.length;
    // 分页显示，每页20条
    showPage(bank, 0, count);
});

function showPage(bank, start, total) {
    var pageSize = 15;
    var end = Math.min(start + pageSize, total);
    var text = "题库 (" + total + " 道)  第 " + (Math.floor(start / pageSize) + 1) + " 页\n\n";
    for (var i = start; i < end; i++) {
        var item = bank[i];
        var q = String(item.q || "");
        var a = String(item.a || "");
        if (q.length > 45) q = q.substring(0, 45) + "...";
        text += (i + 1) + ". " + q + "\n   → " + a + "\n\n";
    }
    var hasMore = end < total;
    var title = "题库 " + (start + 1) + "-" + end + " / " + total;
    if (hasMore) {
        dialogs.build({
            title: title,
            content: text,
            positive: "下一页",
            negative: "关闭"
        }).on("positive", function () {
            showPage(bank, end, total);
        }).show();
    } else {
        alert(title, text);
    }
}
