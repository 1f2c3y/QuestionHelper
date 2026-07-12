// ========================================
// 悬浮窗搜索脚本 (被主脚本调用)
// ========================================

const BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try { return JSON.parse(files.read(BANK_PATH)); } catch (e) { return []; }
}

function search(keyword) {
    let bank = loadBank();
    if (!keyword || keyword.length < 1) return [];
    let results = [];
    let kw = keyword.toLowerCase();
    for (let item of bank) {
        let q = (item.q || "").toLowerCase();
        if (q.indexOf(kw) >= 0) results.push(item);
    }
    results.sort((a, b) => (a.q || "").length - (b.q || "").length);
    return results.slice(0, 10);
}

// 判断是否展开
var isExpanded = false;
var resultViews = [];

// 创建悬浮窗
var floatWindow = floaty.rawWindow(
    <frame id="root" w="auto" h="auto">
        {/* 收起状态：小圆点 */}
        <card id="collapseCard" w="44" h="44" cardCornerRadius="22"
              cardBackgroundColor="#1565C0" cardElevation="8"
              layout_gravity="top|right">
            <text id="collapseText" text="搜" textColor="#FFF" textSize="18sp"
                  textStyle="bold" gravity="center" w="44" h="44"/>
        </card>

        {/* 展开状态：搜索面板 */}
        <card id="expandCard" w="*" cardCornerRadius="12" cardBackgroundColor="#FFFFFF"
              cardElevation="12" visibility="gone" padding="10">
            <vertical>
                {/* 标题栏 */}
                <horizontal gravity="center_vertical">
                    <text text="题库搜索" textSize="16sp" textStyle="bold" textColor="#333" layout_weight="1"/>
                    <text id="closeBtn" text="收起 ▲" textColor="#1565C0" textSize="13sp"
                          padding="8 4" bg="#F0F7FF"/>
                </horizontal>

                {/* 搜索框 */}
                <card cardCornerRadius="8" cardBackgroundColor="#F5F5F5" margin="0 8 0 0">
                    <input id="searchInput" hint="输入关键词搜索答案..." textSize="15sp"
                           h="42" paddingLeft="10"/>
                </card>

                {/* 结果 */}
                <text id="resultTip" text="" textSize="12sp" textColor="#999" margin="4 0"/>
                <vertical id="resultList" />
            </vertical>
        </card>
    </frame>
);

// 点击小圆点→展开
floatWindow.collapseCard.click(() => {
    if (!isExpanded) {
        expand();
    }
});

// 收起按钮
floatWindow.closeBtn.click(() => {
    collapse();
});

// 拖拽
floatWindow.collapseCard.setOnTouchListener(function(view, event) {
    switch (event.getAction()) {
        case event.ACTION_DOWN:
            view.ox = event.getRawX();
            view.oy = event.getRawY();
            view.wx = floatWindow.getX();
            view.wy = floatWindow.getY();
            view.dragged = false;
            return true;
        case event.ACTION_MOVE:
            let dx = event.getRawX() - view.ox;
            let dy = event.getRawY() - view.oy;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) view.dragged = true;
            if (view.dragged) {
                floatWindow.setPosition(view.wx + dx, view.wy + dy);
            }
            return true;
        case event.ACTION_UP:
            if (!view.dragged) view.performClick();
            return true;
    }
    return true;
});

// 搜索
floatWindow.searchInput.on("key", function(keyCode, event) {
    if (event.getAction() === event.ACTION_UP) {
        doSearch(floatWindow.searchInput.getText().toString());
    }
});

function expand() {
    floatWindow.collapseCard.visibility = android.view.View.GONE;
    floatWindow.expandCard.visibility = android.view.View.VISIBLE;

    let w = device.width * 0.92;
    ui.run(() => {
        floatWindow.setSize(Math.floor(w), -2);
        floatWindow.searchInput.requestFocus();
    });
    isExpanded = true;

    // 弹出键盘
    setTimeout(() => {
        floatWindow.searchInput.requestFocus();
    }, 300);
}

function collapse() {
    floatWindow.expandCard.visibility = android.view.View.GONE;
    floatWindow.collapseCard.visibility = android.view.View.VISIBLE;
    ui.run(() => {
        floatWindow.setSize(-2, -2);
    });
    isExpanded = false;
    floatWindow.searchInput.setText("");
    clearResults();
}

function doSearch(keyword) {
    let results = search(keyword);
    clearResults();
    let list = floatWindow.resultList;

    if (results.length === 0) {
        floatWindow.resultTip.setText(keyword ? "未找到匹配" : "");
        return;
    }

    floatWindow.resultTip.setText("找到 " + results.length + " 条");

    let inflater = context.getSystemService(android.content.Context.LAYOUT_INFLATER_SERVICE);
    let maxHeight = Math.floor(device.height * 0.35);

    for (let i = 0; i < results.length; i++) {
        let item = results[i];
        let card = new android.widget.LinearLayout(context);
        card.setOrientation(android.widget.LinearLayout.VERTICAL);
        card.setPadding(dp(10), dp(8), dp(10), dp(8));

        let bg = new android.graphics.drawable.GradientDrawable();
        bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dp(6));
        bg.setColor(0xFFFAFAFA);
        bg.setStroke(1, 0xFFE0E0E0);
        card.setBackground(bg);

        let params = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, dp(6));

        let qText = new android.widget.TextView(context);
        qText.setText(item.q || "");
        qText.setTextColor(0xFF333333);
        qText.setTextSize(13);
        qText.setMaxLines(3);
        qText.setEllipsize(android.text.TextUtils.TruncateAt.END);
        card.addView(qText);

        let aText = new android.widget.TextView(context);
        aText.setText("✓ 答案: " + (item.a || "未知"));
        aText.setTextColor(0xFFD32F2F);
        aText.setTextSize(14);
        aText.setTypeface(null, android.graphics.Typeface.BOLD);
        aText.setPadding(0, dp(4), 0, 0);
        card.addView(aText);

        // 点击收起
        card.setOnClickListener(v => collapse());

        list.addView(card, params);
    }
}

function clearResults() {
    let list = floatWindow.resultList;
    list.removeAllViews();
    floatWindow.resultTip.setText("");
    resultViews = [];
}

function dp(v) {
    return Math.floor(v * context.getResources().getDisplayMetrics().density);
}

// 保持运行
setInterval(() => {}, 1000);

// 关闭时退出
events.on("exit", () => {
    floatWindow.close();
});
