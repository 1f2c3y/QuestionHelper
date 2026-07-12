// ========================================
// 悬浮窗搜索脚本 - 被主脚本调用
// ========================================

var BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try { return JSON.parse(files.read(BANK_PATH)); } catch (e) { return []; }
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
    return results.slice(0, 10);
}

// 创建悬浮窗
var w = floaty.rawWindow(
    <frame id="root" w="auto" h="auto">
        <card id="btn" w="44" h="44" cardCornerRadius="22"
            cardBackgroundColor="#1565C0" cardElevation="8">
            <text text="搜" textColor="#FFFFFF" textSize="18sp"
                textStyle="bold" gravity="center" w="44" h="44" />
        </card>
    </frame>
);

var isExpanded = false;
var searchWin = null;

// 点击按钮：展开/收起
w.btn.click(function () {
    if (isExpanded) {
        collapse();
    } else {
        expand();
    }
});

// 拖拽
var ox, oy, wx, wy, dragged;
w.btn.setOnTouchListener(function (view, event) {
    if (event.getAction() === event.ACTION_DOWN) {
        ox = event.getRawX();
        oy = event.getRawY();
        wx = w.getX();
        wy = w.getY();
        dragged = false;
        return true;
    }
    if (event.getAction() === event.ACTION_MOVE) {
        var dx = event.getRawX() - ox;
        var dy = event.getRawY() - oy;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) dragged = true;
        if (dragged) w.setPosition(wx + dx, wy + dy);
        return true;
    }
    return true;
});

function expand() {
    if (searchWin) return;
    isExpanded = true;

    searchWin = floaty.rawWindow(
        <card w="*" cardCornerRadius="12" cardBackgroundColor="#FFFFFF"
            cardElevation="12" padding="10">
            <vertical>
                <text id="searchTitle" text="题库搜索" textSize="16sp"
                    textStyle="bold" textColor="#333333" />
                <input id="searchInput" hint="输入关键词搜索..." textSize="15sp"
                    h="42" bg="#F0F0F0" marginTop="8" />
                <text id="resultTip" text="" textSize="12sp" textColor="#999999" margin="4 0" />
                <vertical id="resultList" />
                <button id="closeBtn" text="收起" textColor="#1565C0" marginTop="8" />
            </vertical>
        </card>
    );

    var sw = Math.floor(device.width * 0.92);
    searchWin.setSize(sw, -2);
    searchWin.setPosition(Math.floor((device.width - sw) / 2), 100);

    // 搜索 - 轮询方式避免复杂回调
    var lastText = "";
    var searchThread = threads.start(function () {
        while (searchWin) {
            try {
                var txt = searchWin.searchInput.getText().toString();
                if (txt !== lastText) {
                    lastText = txt;
                    doSearch(txt);
                }
            } catch (e) { }
            sleep(300);
        }
    });

    // 收起
    searchWin.closeBtn.click(function () {
        collapse();
        searchThread.interrupt();
    });
}

function collapse() {
    isExpanded = false;
    if (searchWin) {
        try { searchWin.close(); } catch (e) { }
        searchWin = null;
    }
}

function doSearch(keyword) {
    if (!searchWin) return;
    var results = search(keyword);
    var list = searchWin.resultList;

    // 清空
    try { list.removeAllViews(); } catch (e) { }

    if (results.length === 0) {
        searchWin.resultTip.setText(keyword.length > 0 ? "未找到匹配" : "");
        return;
    }

    searchWin.resultTip.setText("找到 " + results.length + " 条");

    var ctx = searchWin.getContext();
    var d = ctx.getResources().getDisplayMetrics().density;
    function dp(v) { return Math.floor(v * d); }

    for (var i = 0; i < results.length; i++) {
        var item = results[i];
        var q = String(item.q || "");
        var a = String(item.a || "");

        var card = new android.widget.LinearLayout(ctx);
        card.setOrientation(1); // VERTICAL
        card.setPadding(dp(10), dp(8), dp(10), dp(8));

        var bg = new android.graphics.drawable.GradientDrawable();
        bg.setShape(0); // RECTANGLE
        bg.setCornerRadius(dp(6));
        bg.setColor(android.graphics.Color.parseColor("#FAFAFA"));
        bg.setStroke(1, android.graphics.Color.parseColor("#E0E0E0"));
        card.setBackground(bg);

        var params = new android.widget.LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, 0, 0, dp(6));

        var qView = new android.widget.TextView(ctx);
        qView.setText(q);
        qView.setTextColor(android.graphics.Color.parseColor("#333333"));
        qView.setTextSize(13);
        qView.setMaxLines(3);
        card.addView(qView);

        var aView = new android.widget.TextView(ctx);
        aView.setText("答案: " + a);
        aView.setTextColor(android.graphics.Color.parseColor("#D32F2F"));
        aView.setTextSize(14);
        aView.setTypeface(null, 1); // BOLD
        aView.setPadding(0, dp(4), 0, 0);
        card.addView(aView);

        // 点击任意结果收回悬浮窗
        card.setOnClickListener(new android.view.View.OnClickListener({
            onClick: function () {
                collapse();
            }
        }));

        list.addView(card, params);
    }
}

// 保活
setInterval(function () { }, 2000);

events.on("exit", function () {
    collapse();
    w.close();
});
