"ui";
// ========================================
// 答题助手 - Auto.js 悬浮窗搜索脚本
// 用法：运行后悬浮窗常驻，输入关键词搜索本地题库
// 题库文件：/sdcard/答题助手题库.json
// ========================================

const BANK_PATH = "/sdcard/答题助手题库.json";

// 读取题库
function loadBank() {
    try {
        let txt = files.read(BANK_PATH);
        return JSON.parse(txt);
    } catch (e) {
        return [];
    }
}

// 保存题库
function saveBank(bank) {
    files.write(BANK_PATH, JSON.stringify(bank, null, 2));
}

// 搜索
function search(keyword) {
    let bank = loadBank();
    if (!keyword || keyword.length < 1) return [];
    let results = [];
    let kw = keyword.toLowerCase();
    for (let item of bank) {
        let q = (item.q || "").toLowerCase();
        let a = (item.a || "").toLowerCase();
        if (q.indexOf(kw) >= 0 || a.indexOf(kw) >= 0) {
            results.push(item);
        }
    }
    // 短匹配优先
    results.sort((a, b) => (a.q || "").length - (b.q || "").length);
    return results.slice(0, 15);
}

// 添加题目
function addQuestion(q, a) {
    let bank = loadBank();
    bank.push({ q: q, a: a, time: new Date().toISOString() });
    saveBank(bank);
}

// ===== 主界面 =====
ui.layout(
    <vertical padding="16" bg="#f5f5f5">
        <text text="答题助手" textSize="22sp" textStyle="bold" textColor="#1565C0" gravity="center" marginTop="30"/>
        <text text="悬浮窗关键词搜索本地题库" textSize="13sp" textColor="#888" gravity="center" marginBottom="20"/>

        <card cardCornerRadius="12" cardElevation="2" marginBottom="12">
            <vertical padding="16">
                <text text="本地题库" textSize="15sp" textColor="#333"/>
                <text id="countText" text="计算中..." textSize="28sp" textStyle="bold" textColor="#1565C0" marginTop="4"/>
            </vertical>
        </card>

        <button id="startFloat" text="开启悬浮窗搜索" style="Widget.AppCompat.Button.Colored" marginTop="8"/>
        <button id="addManual" text="手动录入题目" style="Widget.AppCompat.Button" marginTop="8"/>
        <button id="viewAll" text="查看所有题库" style="Widget.AppCompat.Button" marginTop="8"/>
        <button id="exportBank" text="导出题库备份" style="Widget.AppCompat.Button" marginTop="8"/>

        <text text="提示：在学习强企看到题目时，点击悬浮窗输入关键词即可查找答案"
              textSize="12sp" textColor="#aaa" marginTop="auto" gravity="center" paddingBottom="16"/>
    </vertical>
);

// 刷新计数
ui.countText.setText(loadBank().length + " 道");

// 开启悬浮窗
ui.startFloat.on("click", () => {
    engines.execScriptFile(files.path("./float_search.js"));
    toast("悬浮窗已开启");
});

// 手动录入
ui.addManual.on("click", () => {
    dialogs.build({
        title: "录入题目",
        inputPrefill: "",
        positive: "保存",
    }).on("input", text => {
        let question = text;
        dialogs.rawInput("输入答案 (如 A / B / 正确)", "").then(answer => {
            if (question && answer) {
                addQuestion(question, answer);
                ui.countText.setText(loadBank().length + " 道");
                toast("已保存");
            }
        });
    }).build();
});

// 查看全部
ui.viewAll.on("click", () => {
    let bank = loadBank();
    if (bank.length === 0) {
        toast("题库为空");
        return;
    }
    let text = bank.map((item, i) =>
        (i + 1) + ". " + (item.q || "").substring(0, 50) + "...\n   答案: " + (item.a || "")
    ).join("\n\n");
    dialogs.build({
        title: "题库 (" + bank.length + " 道)",
        content: text,
        positive: "关闭",
    }).show();
});

// 导出
ui.exportBank.on("click", () => {
    let bank = loadBank();
    let text = bank.map((item, i) =>
        "【" + (i + 1) + "】" + (item.q || "") + "\n答案: " + (item.a || "")
    ).join("\n\n");
    let path = "/sdcard/答题助手题库导出_" + new Date().toISOString().slice(0, 10) + ".txt";
    files.write(path, text);
    toast("已导出到 " + path);
});

// 开始悬浮窗搜索(如果之前已开启)
if (floaty.checkPermission()) {
    // 检查是否已有悬浮窗运行
}
