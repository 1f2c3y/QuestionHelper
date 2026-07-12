// ========================================
// 悬浮窗搜索脚本 (被主脚本调用)
// ========================================

var BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try { return JSON.parse(files.read(BANK_PATH)); } catch (e) { return []; }
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
    return results.slice(0, 10);
}

var isExpanded = false;

// 创建悬浮窗 - 只用基本颜色值
var floatWindow = floaty.rawWindow(
    <frame id="root" w="auto" h="auto">
        {/* 收起状态 */}
        <card id="collapseCard" w="44" h="44" cardCornerRadius="22"
            cardBackgroundColor="#1565C0" cardElevation="8">
            <text id="collapseText" text="搜" textColor="#FFFFFF" textSize="18sp"
                textStyle="bold" gravity="center" w="44" h="44" />
        </card>

        {/* 展开状态 */}
        <card id="expandCard" w="*" cardCornerRadius="12" cardBackgroundColor="#FFFFFF"
            cardElevation="12" visibility="gone" padding="10">
            <vertical>
                <horizontal gravity="center_vertical">
                    <text text="题库搜索" textSize="16sp" textStyle="bold" textColor="#333333" layout_weight="1" />
                    <text id="closeBtn" text="收起" textColor="#1565C0" textSize="13sp"
                        padding="8 4" />
                </horizontal>

                <input id="searchInput" hint="输入关键词搜索..." textSize="15sp"
                    h="42" bg="#F0F0F0" />

                <text id="resultTip" text="" textSize="12sp" textColor="#999999" margin="4 0" />
                <vertical id="resultList" />
            </vertical>
        </card>
    </frame>
);

// 点击展开
floatWindow.collapseCard.click(function () {
    expand();
});

// 收起
floatWindow.closeBtn.click(function () {
    collapse();
});

// 搜索监听 - 改用textChangeListener
floatWindow.searchInput.addTextChangedListener({
    afterTextChanged: function (s) {
        doSearch(s.toString());
    },
    beforeTextChanged: function () { },
    onTextChanged: function () { }
});

// 拖拽
floatWindow.collapseCard.setOnTouchListener(function (view, event) {
    switch (event.getAction()) {
        case event.ACTION_DOWN:
            view.ox = event.getRawX();
            view.oy = event.getRawY();
            view.wx = floatWindow.getX();
            view.wy = floatWindow.getY();
            view.dragged = false;
            return true;
        case event.ACTION_MOVE:
            var dx = event.getRawX() - view.ox;
            var dy = event.getRawY() - view.oy;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) view.dragged = true;
            if (view.dragged) {
                floatWindow.setPosition(view.wx + dx, view.wy + dy);
            }
            return true;
        case event.ACTION_UP:
            return true;
    }
    return true;
});

function expand() {
    ui.run(function () {
        floatWindow.collapseCard.setVisibility(8); // GONE
        floatWindow.expandCard.setVisibility(0);   // VISIBLE
    });
    var w = Math.floor(device.width * 0.92);
    floatWindow.setSize(w, -2);
    isExpanded = true;
    setTimeout(function () {
        floatWindow.searchInput.requestFocus();
    }, 300);
}

function collapse() {
    ui.run(function () {
        floatWindow.expandCard.setVisibility(8);
        floatWindow.collapseCard.setVisibility(0);
    });
    floatWindow.setSize(-2, -2);
    isExpanded = false;
    floatWindow.searchInput.setText("");
    clearResults();
}

function doSearch(keyword) {
    var results = search(keyword);
    clearResults();
    var list = floatWindow.resultList;

    if (results.length === 0) {
        ui.run(function () {
            floatWindow.resultTip.setText(keyword.length > 0 ? "未找到匹配" : "");
        });
        return;
    }

    ui.run(function () {
        floatWindow.resultTip.setText("找到 " + results.length + " 条");
    });

    var context = floatWindow.getContext();
    var density = context.getResources().getDisplayMetrics().density;

    function dp(v) {
        return Math.floor(v * density);
    }

    for (var i = 0; i < results.length; i++) {
        (function () {
            var item = results[i];

            var card = new android.widget.LinearLayout(context);
            card.setOrientation(android.widget.LinearLayout.VERTICAL);
            card.setPadding(dp(10), dp(8), dp(10), dp(8));

            var bg = new android.graphics.drawable.GradientDrawable();
            bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
            bg.setCornerRadius(dp(6));
            bg.setColor(android.graphics.Color.parseColor("#FAFAFA"));
            bg.setStroke(1, android.graphics.Color.parseColor("#E0E0E0"));
            card.setBackground(bg);

            var params = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            );
            params.setMargins(0, 0, 0, dp(6));

            var qText = new android.widget.TextView(context);
            qText.setText(item.q || "");
            qText.setTextColor(android.graphics.Color.parseColor("#333333"));
            qText.setTextSize(13);
            qText.setMaxLines(3);
            card.addView(qText);

            var aText = new android.widget.TextView(context);
            aText.setText("答案: " + (item.a || "未知"));
            aText.setTextColor(android.graphics.Color.parseColor("#D32F2F"));
            aText.setTextSize(14);
            aText.setTypeface(null, android.graphics.Typeface.BOLD);
            aText.setPadding(0, dp(4), 0, 0);
            card.addView(aText);

            card.setOnClickListener(new android.view.View.OnClickListener({
                onClick: function () {
                    collapse();
                }
            }));

            ui.run(function () {
                list.addView(card, params);
            });
        })();
    }
}

function clearResults() {
    ui.run(function () {
        var list = floatWindow.resultList;
        list.removeAllViews();
        floatWindow.resultTip.setText("");
    });
}

// 保活
setInterval(function () { }, 1000);

// 退出清理
events.on("exit", function () {
    floatWindow.close();
});
