const TYPE_RULES = [
    { keywords: ['日期', 'date', '创建时间', 'createTime', '更新时间', 'updateTime', '开始日期', '结束日期', '下单日期', '下单时间'], type: 'datePicker', attrs: { type: 'daterange', valueFormat: 'YYYY-MM-DD' } },
    { keywords: ['时间', 'time', '时刻', 'timerange', 'timepicker'], type: 'timePicker', attrs: { type: 'timerange' } },
    { keywords: ['省', '市', '区', '省市', '城市', '地区', 'cascader', '层级', '区域', '级联'], type: 'Cascader' },
    // status BEFORE plain 状态/type/分类 so 'status' wins over generic 'Select'
    { keywords: ['状态', 'status', '类型', 'type', '分类', 'category', '级别', 'level', '来源', 'source', '可见范围', '上架状态'], type: 'Select' },
    { keywords: ['开关', 'switch', '是否', 'enable'], type: 'Switch' },
    { keywords: ['评分', 'rate', '星级', 'score'], type: 'Rate' },
    { keywords: ['颜色', 'color'], type: 'ColorPicker' },
    { keywords: ['图片', 'image', '头像', 'avatar', '文件', 'file', '附件', 'attachment'], type: 'Upload' },
    { keywords: ['备注', 'remark', '描述', 'description', '内容', 'content', '简介', 'intro', '富文本'], type: 'Input', attrs: { type: 'textarea', rows: 3 } },
    { keywords: ['性别', 'gender', '单选', 'radio'], type: 'Radio' },
    { keywords: ['多选', 'checkbox', '兴趣', '爱好', '标签', 'tags'], type: 'Checkbox' },
    { keywords: ['进度', 'slider', '价格区间', '区间', '范围'], type: 'Slider' },
    { keywords: ['穿梭', 'transfer', '分配'], type: 'Transfer' },
];
const FIELD_PROP_MAP = {
    '姓名': 'name', '名称': 'name', '用户名': 'username',
    '手机号': 'phone', '电话': 'phone', '手机': 'phone',
    '邮箱': 'email', '邮件': 'email',
    '状态': 'status', '地址': 'address',
    '订单号': 'orderNo', '编号': 'code', '工单号': 'ticketNo',
    '金额': 'amount', '价格': 'price', '价格区间': 'priceRange',
    '日期': 'date', '时间': 'time',
    '创建时间': 'createTime', '更新时间': 'updateTime',
    '开始时间': 'startTime', '结束时间': 'endTime',
    '下单时间': 'orderTime', '下单日期': 'orderDate', '注册时间': 'registerTime',
    '分类': 'category', '类型': 'type',
    '标题': 'title', '关键词': 'keyword', '标签': 'tags',
    '客户': 'customer', '客户姓名': 'customerName', '客户名称': 'customerName',
    '申请人': 'applicant',
    '年龄': 'age', '性别': 'gender',
    '部门': 'department', '职位': 'position',
    '角色': 'role', '权限': 'permission',
    '商品': 'product', '商品名': 'productName', '商品名称': 'productName',
    '数量': 'quantity', '库存': 'stock',
    '级别': 'level', '来源': 'source',
    '备注': 'remark', '描述': 'description',
    '公司': 'company', '项目': 'project', '品牌': 'brand',
    '账号': 'account', '昵称': 'nickname',
    '创建人': 'creator', '操作人': 'operator',
    '内容': 'content', '简介': 'intro',
    '头像': 'avatar', '图片': 'image',
    '排序': 'sort', '序号': 'sortNo',
    '评分': 'score',
    '订单状态': 'orderStatus', '上架状态': 'listingStatus',
    '会员姓名': 'memberName', '会员': 'member',
    '收货地址': 'shippingAddress', '订单信息': 'orderInfo', '商品列表': 'productList',
    '可见范围': 'visibility', '定时发布时间': 'scheduledAt',
    '省市区': 'region', '省': 'province', '市': 'city', '区': 'district',
};
const STATUS_OPTIONS = [
    { label: '启用', value: 1 },
    { label: '禁用', value: 0 }
];
const TYPE_OPTIONS = [
    { label: '类型A', value: 'A' },
    { label: '类型B', value: 'B' },
    { label: '类型C', value: 'C' }
];
// Words that look like field-list tokens after split but are actually structural
// noise (verb phrases, section markers, modifiers). Without filtering, the
// preview ends up with a column labelled "支" / "底部" / "→" / "弹窗".
const NON_FIELD_TOKENS = new Set([
    '支', '持', '支持', '操作', '查询', '条件', '字段', '包含', '显示', '展示',
    '底部', '固定', '弹窗', '按钮', '每行', '点击', '打开', '都', '可',
    '前后', '跳', '前', '后', '上下架', '批量', '审核', '工单', '会员', '管理',
    '级联', '级联筛选', '筛选', '范围',
    '→', '↔', '↑', '↓', '+', '-',
]);
function inferType(fieldName) {
    for (const rule of TYPE_RULES) {
        if (rule.keywords.some(kw => fieldName.toLowerCase().includes(kw.toLowerCase()))) {
            return { type: rule.type, attrs: rule.attrs };
        }
    }
    return { type: 'Input' };
}
let fieldCounter = 0;
function toProp(fieldName) {
    if (FIELD_PROP_MAP[fieldName])
        return FIELD_PROP_MAP[fieldName];
    if (/^[a-zA-Z_$]/.test(fieldName))
        return fieldName;
    const stripped = fieldName.replace(/[一-鿿]/g, '');
    return stripped || `field_${++fieldCounter}`;
}
function getDataOptions(fieldName) {
    if (/状态|启用|禁用/.test(fieldName))
        return STATUS_OPTIONS;
    if (/类型|分类|级别|来源|可见范围/.test(fieldName))
        return TYPE_OPTIONS;
    if (/性别/.test(fieldName))
        return [{ label: '男', value: 'male' }, { label: '女', value: 'female' }];
    return undefined;
}
/**
 * Default placeholder per formtype — Element Plus has built-in placeholders for
 * Select / DatePicker but el-input renders an empty placeholder, which made the
 * docs preview look unfinished. Adding one explicitly fixes that AND covers
 * Vue 2 element-ui which has slightly different defaults.
 */
function defaultPlaceholder(label, formtype) {
    switch (formtype) {
        case 'Select':
        case 'Cascader':
        case 'Radio':
        case 'Checkbox':
        case 'Transfer':
            return `请选择${label}`;
        case 'datePicker':
        case 'timePicker':
            return `请选择${label}`;
        case 'Upload':
            return `请上传${label}`;
        case 'Switch':
        case 'Rate':
        case 'Slider':
        case 'ColorPicker':
            return label; // these widgets don't show placeholders
        default:
            return `请输入${label}`;
    }
}
// ─── input normalization ─────────────────────────────────────────────────────
/**
 * Strip parenthetical modifiers like 状态（启用/禁用） → 状态. Without this
 * the open-paren breaks the field-list regex (the inner char class doesn't
 * include `（` so the lookahead can't terminate). Keeps the field name clean
 * for type inference (status → Select, with correct dataOptions).
 *
 * Also normalizes arrows (→ ↔) to comma so cascading specs like "省 → 市 → 区"
 * become parseable as a field list.
 */
function normalizeInput(input) {
    return input
        .replace(/[（(][^）)]*[）)]/g, '') // remove (...) / （...）
        .replace(/\s*[→↔]\s*/g, '、') // cascading arrows → field-list separator
        .replace(/\s+/g, ' ');
}
// ─── field-list extraction (replaces the fragile lookahead regex) ────────────
/**
 * Lift a section out of the prompt that starts with one of the head markers
 * (e.g. 查询/表格/列表) and ends at the next section boundary or a sentence
 * terminator. Returns the text between the marker and the boundary, with the
 * marker's optional prefix words (条件/字段/列/显示/展示) consumed.
 *
 * Why a forward scanner instead of one big regex with lookahead: the original
 * regex used a char class that wouldn't accept Chinese fullwidth punctuation,
 * brackets, or arrows. Once any of those appeared mid-segment, the lookahead
 * had nothing to anchor on and the whole match failed silently. A scanner
 * with an explicit boundary set is both more readable and fails open
 * (worst case it captures a bit too much, which downstream `splitFields`
 * cleans up).
 */
function extractSection(input, heads, boundaries) {
    const m = heads.exec(input);
    if (!m)
        return '';
    const start = m.index + m[0].length;
    const rest = input.slice(start);
    const b = boundaries.exec(rest);
    return b ? rest.slice(0, b.index) : rest;
}
/**
 * Split a section into tokens. Also splits on : / ： — that handles prompts
 * where the user wrote "包含级联筛选：省、市、区" and the head regex captured
 * the whole "包含级联筛选：省、市、区" as one section; splitting on : breaks
 * it into ["包含级联筛选", "省", "市", "区"] which the NON_FIELD filter
 * cleans up further.
 */
function splitFields(str) {
    if (!str)
        return [];
    // Strip noise lead-ins like "包含" / "包括" / "有" — they're not field names
    // but they survive the section-head regex when the prompt phrases the list
    // as e.g. "查询条件包含X、Y、Z".
    const cleaned = str
        .replace(/^[\s,，、:：]*/, '')
        .replace(/^(?:包含|含有|有|包括|including?)\s*[:：]?/i, '')
        .trim();
    return cleaned
        .split(/[、，,;；:：\s]+/)
        .map(s => s.trim())
        .filter(s => {
        if (!s)
            return false;
        if (s.length > 10)
            return false; // too long → likely a clause, not a field
        if (s.length < 2 && !/[a-zA-Z]/.test(s))
            return false; // single Chinese char → likely noise
        if (NON_FIELD_TOKENS.has(s))
            return false;
        return true;
    });
}
function parseFields(rawInput) {
    // ─ Multi-step form special case ───────────────────────────────────────
    // Prompts like "第一步基础信息（标题、分类、标签），第二步..." encode the
    // ACTUAL field list inside per-step parens. normalizeInput strips parens
    // (necessary for the other 5 presets), so we extract steps BEFORE that.
    // Without this preset 4 ends up with a single garbled "第一步基础信息"
    // field instead of 6 real ones.
    const stepMatches = [...rawInput.matchAll(/第[一二三四五六七八九十1-9]步[^（(]*[（(]([^）)]+)[）)]/g)];
    if (stepMatches.length > 0) {
        const stepFields = [];
        const seenStep = new Set();
        for (const m of stepMatches) {
            for (const name of splitFields(m[1])) {
                if (seenStep.has(name))
                    continue;
                seenStep.add(name);
                const t = inferType(name);
                stepFields.push({
                    name, prop: toProp(name), type: t.type, attrs: t.attrs,
                    isQuery: true, isTable: false, isForm: true,
                });
            }
        }
        if (stepFields.length > 0)
            return stepFields;
    }
    const input = normalizeInput(rawInput);
    const fields = [];
    // Boundary regex for query section: next major section marker OR sentence end.
    // CAUTION: only put words here that CANNOT appear as field names — "分类"
    // is a common field name (preset 3 table includes 分类) and was previously a
    // boundary, which truncated the table section before its first item.
    const queryBoundary = /表格|列表|支持|操作|底部|每行|点击|弹窗|多步|第[一二三四五六七八九十1-9]步|[。;；]/;
    const tableBoundary = /查询|支持|操作|底部|每行|点击|弹窗|多步|第[一二三四五六七八九十1-9]步|[。;；]/;
    // Match either "查询" or "查询条件" or "查询字段" optionally followed by ：
    const queryHead = /查询(?:条件|字段)?[：:有]?/;
    // Match REAL table heads, NOT compound nouns like "商品列表" / "订单列表".
    // A real table head must be followed by list-introducing context — either:
    //   (a) "表格" / "列表" + one of 列/字段/显示/展示/有/：:  (e.g. "表格列：", "列表显示")
    //   (b) bare "列：" or "字段：" (e.g. preset 3's "...。列：商品名、...")
    // Without the trailing-context requirement, "商品列表，" matches at position 2
    // and the body that follows ("，10 万行数据，...") becomes garbage table fields.
    const tableHead = /(?:(?:表格|列表|list)[列字段显示展示有：:]+|(?:列|字段)[：:])/i;
    const querySection = extractSection(input, queryHead, queryBoundary);
    const tableSection = extractSection(input, tableHead, tableBoundary);
    let queryFieldNames = splitFields(querySection);
    const tableFieldNames = splitFields(tableSection);
    // Collapse "省 → 市 → 区" / "级联筛选省市区" patterns into ONE Cascader
    // field named 省市区. Without this, the 3 single chars (省/市/区) get
    // filtered as noise (single Chinese char) and the query ends up empty.
    if (/级联|省市区/.test(rawInput) || (/省/.test(querySection) && /市/.test(querySection) && /区/.test(querySection))) {
        // Strip the individual 省/市/区 tokens (if any leaked through) and prepend
        // a synthetic 省市区 field so the user sees a real Cascader in preview.
        queryFieldNames = ['省市区', ...queryFieldNames.filter(n => !['省', '市', '区'].includes(n))];
    }
    // Both sections empty → fallback: extract field-like tokens from the whole prompt
    if (queryFieldNames.length === 0 && tableFieldNames.length === 0) {
        const allFields = extractAllFields(input);
        allFields.forEach(name => {
            const t = inferType(name);
            fields.push({
                name, prop: toProp(name), type: t.type, attrs: t.attrs,
                isQuery: true, isTable: true, isForm: true,
            });
        });
        return fields;
    }
    const seen = new Set();
    // STRICT mode: when the prompt explicitly enumerates BOTH a query section
    // and a table section, treat them as independent lists — query fields are
    // query-only unless they also appear in the table list, and vice versa.
    // Without this, a query-only filter like "价格区间" (range slider) would
    // pollute the table column list because the implicit-merge default added
    // every query field to the table too.
    //
    // IMPLICIT mode: when only one section is given, the user means "this
    // single list drives both query and table" — fall back to the merged
    // behaviour so a prompt like "查询姓名、手机号" yields a 2-field query AND
    // a 2-column table.
    const strict = queryFieldNames.length > 0 && tableFieldNames.length > 0;
    const tableNameSet = new Set(tableFieldNames);
    queryFieldNames.forEach(name => {
        if (seen.has(name))
            return;
        seen.add(name);
        const t = inferType(name);
        fields.push({
            name, prop: toProp(name), type: t.type, attrs: t.attrs,
            isQuery: true,
            isTable: strict ? tableNameSet.has(name) : true,
            isForm: true,
        });
    });
    tableFieldNames.forEach(name => {
        if (seen.has(name))
            return;
        seen.add(name);
        const t = inferType(name);
        fields.push({
            name, prop: toProp(name), type: t.type, attrs: t.attrs,
            isQuery: false, isTable: true, isForm: true,
        });
    });
    return fields;
}
function extractAllFields(input) {
    // Strip leading "X：" prefix and trailing 支持... / 操作... / 多步... / 弹窗... clauses
    const cleaned = input
        .replace(/^[^：:]*[：:]/, '')
        .replace(/[，,。.]\s*(支持|操作|底部|每行|点击|多步|第[一二三四五六七八九十1-9]步|启用|启动|开启|弹窗)[\s\S]*$/, '');
    return splitFields(cleaned);
}
function parseActions(input) {
    if (/只(?:查看|读|浏览)/.test(input))
        return ['view'];
    const actionMatch = input.match(/(?:支持|操作[有：:]?)\s*([^。.]*)/g);
    const actionSection = actionMatch ? actionMatch.join(' ') : '';
    // Also catch "每行有…详情按钮" / "每行有…查看" patterns (used by Preset 2)
    // and "底部固定栏…批准/拒绝按钮" patterns (used by Preset 5).
    const rowBtnSection = /每行有?([^。.]*)/.test(input) ? input.match(/每行有?([^。.]*)/)?.[0] ?? '' : '';
    const footerBtnSection = /底部([^。.]*按钮)/.test(input) ? input.match(/底部([^。.]*按钮)/)?.[0] ?? '' : '';
    const text = `${actionSection} ${rowBtnSection} ${footerBtnSection}`;
    if (!text.trim())
        return ['add', 'edit', 'delete'];
    const actions = [];
    if (/新增|添加|创建|add|create/i.test(text))
        actions.push('add');
    if (/编辑|修改|更新|edit|update/i.test(text))
        actions.push('edit');
    if (/删除|移除|remove|delete/i.test(text))
        actions.push('delete');
    if (/查看|详情|detail|view/i.test(text))
        actions.push('view');
    if (/导出|export/i.test(text))
        actions.push('export');
    if (/导入|import/i.test(text))
        actions.push('import');
    if (/批准|通过|approve/i.test(text))
        actions.push('approve');
    if (/拒绝|驳回|reject/i.test(text))
        actions.push('reject');
    if (/上架|下架|批量上下架/i.test(text))
        actions.push('toggleListing');
    return actions.length > 0 ? actions : ['add', 'edit', 'delete'];
}
// ─── special-feature detection ───────────────────────────────────────────────
/**
 * Scan the prompt for features the preview can't fully render (multi-tab
 * detail dialog, multi-step form, cross-page selection toolbar, etc.) and
 * also detect features that DO map to a config flag (virtual scrolling,
 * row-selection column). Returns { featureHints, tableOptions } so the
 * caller can merge into the generated config.
 */
function detectFeatures(input) {
    const hints = [];
    const patches = {};
    // Virtual scrolling — set the flag AND surface as a feature note
    if (/虚拟滚动|virtual|10\s*万行|十万行|大数据|百万行/i.test(input)) {
        patches.virtual = true;
        hints.push('虚拟滚动（10 万行级数据）— `options.virtual: true` 已启用');
    }
    // Cross-page selection toolbar
    if (/跨页|cross-page/i.test(input) || /批量(审核|审批|删除|上下架|操作)/.test(input)) {
        patches.cachePageSelection = true;
        patches.selection = true;
        hints.push('跨页批量选择 — `options.cachePageSelection: true` + selection 列已启用，底部 toolbar 需自行实现');
    }
    // Multi-tab detail dialog
    if (/多\s*tab|多个?tab|三个?tab|tabs?\s*：|tab[：:].*tab/i.test(input)) {
        hints.push('详情弹窗多 Tab — preview 仅显示主表，多 tab 弹窗需通过 `useDialog` + el-tabs 自行实现');
    }
    // Multi-step form
    if (/多步表单|多步骤|分步|第[一二三四五六七八九十1-9]步|step\s*\d+|多步/i.test(input)) {
        hints.push('多步表单 — preview 仅显示扁平表单，分步流程需用 `el-steps` 拆分');
    }
    // Cascading filter
    if (/级联(筛选|选择)?|cascader|省\s*[→\-、，,]\s*市|省市区/i.test(input)) {
        hints.push('级联筛选 — preview 显示静态 Cascader，实际数据需走 `apiParams` 远程加载');
    }
    // Rich text
    if (/富文本|rich\s*text|wysiwyg/i.test(input)) {
        hints.push('富文本编辑器 — 需集成第三方编辑器（如 wangeditor / tinymce）');
    }
    return { featureHints: hints, optionPatches: patches };
}
// ─── span normalization (fixes the form-grid misalignment) ───────────────────
/**
 * Pick a per-field span so every row totals exactly 24 (Element Plus's grid).
 * Without this, mixing datePicker (span 8) with Input (span 6) creates
 * 8+6+6=20 rows with a 4-col gap — that's the "栅格布局不整齐" complaint.
 *
 * Strategy: prefer 8 columns per row (3 fields/row) when ≥3 fields and any
 * are datePicker/timePicker; otherwise use 6 (4 fields/row). Last item on
 * each row absorbs any remainder so the row always closes at 24.
 */
function normalizeSpans(formItems) {
    if (formItems.length === 0)
        return;
    const wantsWide = formItems.some((f) => f.formtype === 'datePicker' || f.formtype === 'timePicker' || f.formtype === 'Cascader');
    const baseSpan = wantsWide ? 8 : 6;
    const perRow = 24 / baseSpan; // 3 or 4
    formItems.forEach((f, i) => {
        const positionInRow = i % perRow;
        const isLastInRow = positionInRow === perRow - 1;
        const isLastOverall = i === formItems.length - 1;
        // Last item in an incomplete final row absorbs the remainder so the row closes
        if (isLastOverall && !isLastInRow) {
            f.span = 24 - positionInRow * baseSpan;
        }
        else {
            f.span = baseSpan;
        }
    });
}
// ─── public entry ────────────────────────────────────────────────────────────
export function generateCrudConfig(input) {
    const fields = parseFields(input);
    const actions = parseActions(input);
    const { featureHints, optionPatches } = detectFeatures(input);
    const formItems = fields
        .filter(f => f.isQuery)
        .map(f => {
        const item = {
            prop: f.prop,
            label: f.name,
            formtype: f.type,
            // span filled in by normalizeSpans below
            span: 6,
            attrs: {
                clearable: f.type !== 'Switch' && f.type !== 'Rate' && f.type !== 'Slider',
                placeholder: defaultPlaceholder(f.name, f.type),
                ...(f.attrs ?? {}),
            },
        };
        const options = getDataOptions(f.name);
        if (options)
            item.dataOptions = options;
        return item;
    });
    normalizeSpans(formItems);
    const queryBtns = [
        { name: '查询', type: 'primary', key: 'query', triggerEvent: true },
        { name: '重置', key: 'rest', triggerEvent: true },
    ];
    if (actions.includes('add')) {
        queryBtns.push({ name: '新增', type: 'primary', key: 'add', icon: 'Plus' });
    }
    if (actions.includes('export')) {
        queryBtns.push({ name: '导出', key: 'export', icon: 'Download' });
    }
    if (actions.includes('import')) {
        queryBtns.push({ name: '导入', key: 'import', icon: 'Upload' });
    }
    if (actions.includes('approve')) {
        queryBtns.push({ name: '批准', type: 'success', key: 'approve' });
    }
    if (actions.includes('reject')) {
        queryBtns.push({ name: '拒绝', type: 'danger', key: 'reject' });
    }
    if (actions.includes('toggleListing')) {
        queryBtns.push({ name: '批量上架', type: 'success', key: 'batchList' });
        queryBtns.push({ name: '批量下架', type: 'warning', key: 'batchUnlist' });
    }
    let hasStatusRender = false;
    const columns = fields
        .filter(f => f.isTable)
        .map(f => {
        const col = { prop: f.prop, label: f.name };
        if (/状态|status/i.test(f.name)) {
            hasStatusRender = true;
            col.render = `(_, { row }) => h(ElTag, { type: row.${f.prop} === 1 ? 'success' : 'danger' }, () => row.${f.prop} === 1 ? '启用' : '禁用')`;
        }
        // datePicker → table column should be wider so the date isn't cropped
        if (f.type === 'datePicker')
            col.width = 180;
        // Amount/price → right align for readability
        if (/金额|价格|amount|price/i.test(f.name))
            col.align = 'right';
        return col;
    });
    const actionBtns = [];
    if (actions.includes('view'))
        actionBtns.push({ name: '查看', type: 'primary' });
    if (actions.includes('edit'))
        actionBtns.push({ name: '编辑', type: 'primary' });
    if (actions.includes('delete'))
        actionBtns.push({ name: '删除', type: 'danger' });
    if (actionBtns.length > 0) {
        columns.push({
            prop: 'operate',
            label: '操作',
            width: actionBtns.length * 80 + 20,
            btns: actionBtns
        });
    }
    const tableOptions = {
        border: true,
        stripe: true,
        highlightCurrentRow: true,
        headerCellStyle: { background: '#f5f7fa' },
        rowkey: 'id',
        ...optionPatches,
    };
    const dialogFormItems = fields
        .filter(f => f.isForm)
        .map(f => {
        const item = {
            prop: f.prop,
            label: f.name,
            formtype: f.type,
            span: 24,
            attrs: {
                clearable: f.type !== 'Switch' && f.type !== 'Rate' && f.type !== 'Slider',
                placeholder: defaultPlaceholder(f.name, f.type),
                ...(f.attrs ?? {}),
            },
            formItemOptions: {
                rules: [{ required: true, message: `请输入${f.name}`, trigger: 'blur' }]
            },
        };
        const options = getDataOptions(f.name);
        if (options) {
            item.dataOptions = options;
            item.formItemOptions.rules = [{ required: true, message: `请选择${f.name}`, trigger: 'change' }];
        }
        return item;
    });
    return {
        formItems,
        columns,
        queryBtns,
        tableOptions,
        actions,
        dialogFormItems,
        hasStatusRender,
        featureHints,
    };
}
export function generateCode(config) {
    const lines = [];
    const hasDialog = config.actions.includes('add') || config.actions.includes('edit') || config.actions.includes('view');
    const hasDelete = config.actions.includes('delete');
    lines.push(`<template>`);
    lines.push(`  <es-table`);
    lines.push(`    ref="tableRef"`);
    lines.push(`    :columns="columns"`);
    lines.push(`    :options="options"`);
    lines.push(`    v-model:data-source="tableData"`);
    lines.push(`    v-model:pagination="pagination"`);
    lines.push(`  >`);
    lines.push(`    <es-form :model="queryForm" :form-item-list="formItems" :config-btn="queryBtns" />`);
    lines.push(`  </es-table>`);
    lines.push(`</template>`);
    lines.push(``);
    // When there's a dialog, the generated code emits `render: (h) => <EsForm .../>`
    // JSX — that requires `lang="jsx"` on the script tag plus the
    // @vitejs/plugin-vue-jsx (or babel preset for Vue 2). Without lang, the SFC
    // compiler routes the body through the plain-JS loader which chokes on JSX.
    const scriptLang = hasDialog ? ' lang="jsx"' : '';
    lines.push(`<script setup${scriptLang}>`);
    // Vue imports
    const vueImports = ['reactive', 'ref'];
    if (config.hasStatusRender)
        vueImports.push('h');
    lines.push(`import { ${vueImports.join(', ')} } from 'vue'`);
    // @es-plus/vue3 imports
    if (hasDialog) {
        lines.push(`import { useDialog } from '@es-plus/vue3'`);
    }
    // element-plus imports
    const epImports = [];
    if (config.hasStatusRender)
        epImports.push('ElTag');
    if (hasDelete)
        epImports.push('ElMessageBox', 'ElMessage');
    if (epImports.length > 0) {
        lines.push(`import { ${epImports.join(', ')} } from 'element-plus'`);
    }
    lines.push(``);
    const modelFields = config.formItems.map(f => `${f.prop}: ''`).join(', ');
    lines.push(`const queryForm = reactive({ ${modelFields} })`);
    lines.push(`const tableData = ref([])`);
    lines.push(`const tableRef = ref(null)`);
    lines.push(`const pagination = ref({ current: 1, pageSize: 10, total: 0 })`);
    if (hasDialog) {
        lines.push(`const dialog = useDialog()`);
    }
    lines.push(``);
    // Surface feature hints as code comments so users see them in the generated SFC too
    if (config.featureHints && config.featureHints.length > 0) {
        lines.push(`// ─── Feature notes from the prompt ───`);
        for (const hint of config.featureHints) {
            lines.push(`// • ${hint}`);
        }
        lines.push(``);
    }
    lines.push(`const formItems = ${JSON.stringify(config.formItems, null, 2)}`);
    lines.push(``);
    // queryBtns — need to serialize click handlers as code, not JSON
    lines.push(`const queryBtns = [`);
    for (const btn of config.queryBtns) {
        if (btn.key === 'add') {
            lines.push(`  { name: '${btn.name}', type: '${btn.type}', key: '${btn.key}', icon: '${btn.icon}', click: () => openForm('新增') },`);
        }
        else if (btn.key === 'export') {
            lines.push(`  { name: '${btn.name}', key: '${btn.key}', icon: '${btn.icon}', click: () => { /* TODO: 调用导出接口 */ } },`);
        }
        else if (btn.key === 'import') {
            lines.push(`  { name: '${btn.name}', key: '${btn.key}', icon: '${btn.icon}', click: () => { /* TODO: 调用导入接口 */ } },`);
        }
        else {
            const parts = [`name: '${btn.name}'`];
            if (btn.type)
                parts.push(`type: '${btn.type}'`);
            parts.push(`key: '${btn.key}'`);
            if (btn.triggerEvent)
                parts.push(`triggerEvent: true`);
            lines.push(`  { ${parts.join(', ')} },`);
        }
    }
    lines.push(`]`);
    lines.push(``);
    // columns — render functions need to be unquoted
    const colStr = JSON.stringify(config.columns, null, 2)
        .replace(/"render": "(.*?)"/g, (_, code) => `render: ${code.replace(/\\"/g, '"')}`);
    lines.push(`const columns = ${colStr}`);
    lines.push(``);
    // table options — httpRequest 和 configTableOut 由全局配置注入，无需在此重复声明
    // 全局配置示例见 main.ts: app.use(ESPlus, { EsTable: { methods: { $httpRequest, configQueryFieldOutput } } })
    lines.push(`const options = ${JSON.stringify(config.tableOptions, null, 2)}`);
    // delete handler
    if (hasDelete) {
        lines.push(``);
        lines.push(`function handleDelete(row) {`);
        lines.push(`  ElMessageBox.confirm('确定删除该条数据吗？', '提示', { type: 'warning' })`);
        lines.push(`    .then(async () => {`);
        lines.push(`      // TODO: 调用删除接口`);
        lines.push(`      // await axios.delete(\`/api/item/\${row.id}\`)`);
        lines.push(`      ElMessage.success('删除成功')`);
        lines.push(`      tableRef.value?.httpRequestInstance()`);
        lines.push(`    })`);
        lines.push(`    .catch(() => {})`);
        lines.push(`}`);
    }
    // dialog form
    if (hasDialog) {
        lines.push(``);
        lines.push(`function openForm(title, row = {}) {`);
        const dialogModelFields = (config.dialogFormItems || []).map(f => `${f.prop}: ''`).join(', ');
        lines.push(`  const formData = reactive({ ${dialogModelFields}, ...row })`);
        lines.push(`  const isView = title === '查看'`);
        lines.push(`  dialog({`);
        lines.push(`    title,`);
        lines.push(`    width: '500px',`);
        lines.push(`    render: (h, { registerRef }) => (`);
        lines.push(`      <EsForm`);
        lines.push(`        ref={el => el && registerRef('form', el)}`);
        lines.push(`        model={formData}`);
        // dialog form items without formItemOptions for view mode
        const dialogItemsStr = JSON.stringify(config.dialogFormItems, null, 8);
        lines.push(`        formItemList={${dialogItemsStr}}`);
        lines.push(`      />`);
        lines.push(`    ),`);
        if (config.actions.includes('view') && !config.actions.includes('add') && !config.actions.includes('edit')) {
            // view-only: no configBtn
            lines.push(`    configBtn: isView ? [] : [`);
        }
        else {
            lines.push(`    configBtn: isView ? [`);
            lines.push(`      { name: '关闭', click: (_, { close }) => close() }`);
            lines.push(`    ] : [`);
        }
        lines.push(`      { name: '取消', click: (_, { close }) => close() },`);
        lines.push(`      { name: '确定', type: 'primary', click: async (_, { close, getRefs }) => {`);
        lines.push(`        try {`);
        lines.push(`          await getRefs('form')?.validate()`);
        lines.push(`          // TODO: 调用保存接口`);
        lines.push(`          // await axios.post('/api/save', formData)`);
        lines.push(`          close()`);
        lines.push(`          tableRef.value?.httpRequestInstance()`);
        lines.push(`        } catch {`);
        lines.push(`          // 表单验证失败`);
        lines.push(`        }`);
        lines.push(`      }}`);
        lines.push(`    ]`);
        lines.push(`  })`);
        lines.push(`}`);
    }
    lines.push(`</script>`);
    // Post-process: wire up action column clickEvent references
    let code = lines.join('\n');
    code = code.replace(/"name": "编辑",\s*"type": "primary"/g, '"name": "编辑", "type": "primary", "clickEvent": (row) => openForm(\'编辑\', row)');
    code = code.replace(/"name": "查看",\s*"type": "primary"/g, '"name": "查看", "type": "primary", "clickEvent": (row) => openForm(\'查看\', row)');
    code = code.replace(/"name": "删除",\s*"type": "danger"/g, '"name": "删除", "type": "danger", "clickEvent": (row) => handleDelete(row)');
    return code;
}
//# sourceMappingURL=crud-engine.js.map