import { z } from 'zod';
declare const FieldRuleSchema: z.ZodObject<{
    required: z.ZodOptional<z.ZodBoolean>;
    pattern: z.ZodOptional<z.ZodString>;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
    type: z.ZodOptional<z.ZodEnum<{
        string: "string";
        number: "number";
        email: "email";
        integer: "integer";
        url: "url";
    }>>;
    message: z.ZodString;
    trigger: z.ZodOptional<z.ZodEnum<{
        blur: "blur";
        change: "change";
    }>>;
}, z.core.$strip>;
declare const FieldConfigSchema: z.ZodObject<{
    prop: z.ZodString;
    label: z.ZodString;
    formtype: z.ZodEnum<{
        [x: string]: string;
    }>;
    inQuery: z.ZodDefault<z.ZodBoolean>;
    inTable: z.ZodDefault<z.ZodBoolean>;
    inForm: z.ZodDefault<z.ZodBoolean>;
    querySpan: z.ZodOptional<z.ZodNumber>;
    formSpan: z.ZodOptional<z.ZodNumber>;
    required: z.ZodOptional<z.ZodBoolean>;
    rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
        required: z.ZodOptional<z.ZodBoolean>;
        pattern: z.ZodOptional<z.ZodString>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        type: z.ZodOptional<z.ZodEnum<{
            string: "string";
            number: "number";
            email: "email";
            integer: "integer";
            url: "url";
        }>>;
        message: z.ZodString;
        trigger: z.ZodOptional<z.ZodEnum<{
            blur: "blur";
            change: "change";
        }>>;
    }, z.core.$strip>>>;
    attrs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    dataOptions: z.ZodOptional<z.ZodArray<z.ZodType<any, unknown, z.core.$ZodTypeInternals<any, unknown>>>>;
    apiParams: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        method: z.ZodOptional<z.ZodEnum<{
            GET: "GET";
            POST: "POST";
        }>>;
        labelField: z.ZodOptional<z.ZodString>;
        valueField: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    width: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    minWidth: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    align: z.ZodOptional<z.ZodEnum<{
        right: "right";
        left: "left";
        center: "center";
    }>>;
    fixed: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"left">, z.ZodLiteral<"right">]>>;
    ellipsis: z.ZodOptional<z.ZodBoolean>;
    formatter: z.ZodOptional<z.ZodString>;
    render: z.ZodOptional<z.ZodString>;
    permissionValue: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const StructuredCrudConfigSchema: z.ZodObject<{
    name: z.ZodString;
    apiUrl: z.ZodString;
    fields: z.ZodArray<z.ZodObject<{
        prop: z.ZodString;
        label: z.ZodString;
        formtype: z.ZodEnum<{
            [x: string]: string;
        }>;
        inQuery: z.ZodDefault<z.ZodBoolean>;
        inTable: z.ZodDefault<z.ZodBoolean>;
        inForm: z.ZodDefault<z.ZodBoolean>;
        querySpan: z.ZodOptional<z.ZodNumber>;
        formSpan: z.ZodOptional<z.ZodNumber>;
        required: z.ZodOptional<z.ZodBoolean>;
        rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
            required: z.ZodOptional<z.ZodBoolean>;
            pattern: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            type: z.ZodOptional<z.ZodEnum<{
                string: "string";
                number: "number";
                email: "email";
                integer: "integer";
                url: "url";
            }>>;
            message: z.ZodString;
            trigger: z.ZodOptional<z.ZodEnum<{
                blur: "blur";
                change: "change";
            }>>;
        }, z.core.$strip>>>;
        attrs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        dataOptions: z.ZodOptional<z.ZodArray<z.ZodType<any, unknown, z.core.$ZodTypeInternals<any, unknown>>>>;
        apiParams: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            method: z.ZodOptional<z.ZodEnum<{
                GET: "GET";
                POST: "POST";
            }>>;
            labelField: z.ZodOptional<z.ZodString>;
            valueField: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        width: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        minWidth: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        align: z.ZodOptional<z.ZodEnum<{
            right: "right";
            left: "left";
            center: "center";
        }>>;
        fixed: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"left">, z.ZodLiteral<"right">]>>;
        ellipsis: z.ZodOptional<z.ZodBoolean>;
        formatter: z.ZodOptional<z.ZodString>;
        render: z.ZodOptional<z.ZodString>;
        permissionValue: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    actions: z.ZodArray<z.ZodEnum<{
        [x: string]: string;
    }>>;
    tableOptions: z.ZodOptional<z.ZodObject<{
        border: z.ZodDefault<z.ZodBoolean>;
        stripe: z.ZodDefault<z.ZodBoolean>;
        rowkey: z.ZodDefault<z.ZodString>;
        heightType: z.ZodOptional<z.ZodEnum<{
            maxHeight: "maxHeight";
            height: "height";
            auto: "auto";
        }>>;
        tabHeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        multiSelect: z.ZodOptional<z.ZodBoolean>;
        highlightCurrentRow: z.ZodDefault<z.ZodBoolean>;
        headerCellStyle: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        virtual: z.ZodOptional<z.ZodBoolean>;
        rowHeight: z.ZodOptional<z.ZodNumber>;
        estimatedRowHeight: z.ZodOptional<z.ZodNumber>;
        overscanCount: z.ZodOptional<z.ZodNumber>;
        rowClassName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    pagination: z.ZodOptional<z.ZodObject<{
        pageSize: z.ZodDefault<z.ZodNumber>;
        pageSizes: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>;
    mode: z.ZodDefault<z.ZodEnum<{
        schema: "schema";
        sfc: "sfc";
    }>>;
    target: z.ZodDefault<z.ZodEnum<{
        vue3: "vue3";
        vue2: "vue2";
    }>>;
    typescript: z.ZodDefault<z.ZodBoolean>;
    permissions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    i18n: z.ZodDefault<z.ZodBoolean>;
    formLayout: z.ZodOptional<z.ZodObject<{
        span: z.ZodOptional<z.ZodNumber>;
        labelWidth: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        minFoldRows: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    toolbarBtns: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        dialogKey: z.ZodOptional<z.ZodString>;
        actionType: z.ZodOptional<z.ZodString>;
        confirm: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>;
        permissionValue: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    tableBtns: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        code: z.ZodDefault<z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>]>>;
        dialogKey: z.ZodOptional<z.ZodString>;
        actionType: z.ZodOptional<z.ZodString>;
        confirm: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>;
        permissionValue: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    operationColumn: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<false>, z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        width: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        fixed: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"left">, z.ZodLiteral<"right">]>>;
        btns: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
            type: z.ZodOptional<z.ZodString>;
            icon: z.ZodOptional<z.ZodString>;
            dialogKey: z.ZodOptional<z.ZodString>;
            confirm: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>;
            permissionValue: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>]>>;
    dialogs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        width: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        formItems: z.ZodOptional<z.ZodArray<z.ZodObject<{
            prop: z.ZodString;
            label: z.ZodString;
            formtype: z.ZodEnum<{
                [x: string]: string;
            }>;
            inQuery: z.ZodDefault<z.ZodBoolean>;
            inTable: z.ZodDefault<z.ZodBoolean>;
            inForm: z.ZodDefault<z.ZodBoolean>;
            querySpan: z.ZodOptional<z.ZodNumber>;
            formSpan: z.ZodOptional<z.ZodNumber>;
            required: z.ZodOptional<z.ZodBoolean>;
            rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
                required: z.ZodOptional<z.ZodBoolean>;
                pattern: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                type: z.ZodOptional<z.ZodEnum<{
                    string: "string";
                    number: "number";
                    email: "email";
                    integer: "integer";
                    url: "url";
                }>>;
                message: z.ZodString;
                trigger: z.ZodOptional<z.ZodEnum<{
                    blur: "blur";
                    change: "change";
                }>>;
            }, z.core.$strip>>>;
            attrs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            dataOptions: z.ZodOptional<z.ZodArray<z.ZodType<any, unknown, z.core.$ZodTypeInternals<any, unknown>>>>;
            apiParams: z.ZodOptional<z.ZodObject<{
                url: z.ZodString;
                method: z.ZodOptional<z.ZodEnum<{
                    GET: "GET";
                    POST: "POST";
                }>>;
                labelField: z.ZodOptional<z.ZodString>;
                valueField: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            width: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
            minWidth: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
            align: z.ZodOptional<z.ZodEnum<{
                right: "right";
                left: "left";
                center: "center";
            }>>;
            fixed: z.ZodOptional<z.ZodUnion<readonly [z.ZodBoolean, z.ZodLiteral<"left">, z.ZodLiteral<"right">]>>;
            ellipsis: z.ZodOptional<z.ZodBoolean>;
            formatter: z.ZodOptional<z.ZodString>;
            render: z.ZodOptional<z.ZodString>;
            permissionValue: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        formLayout: z.ZodOptional<z.ZodObject<{
            span: z.ZodOptional<z.ZodNumber>;
            labelWidth: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            minFoldRows: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        hasCustomRender: z.ZodOptional<z.ZodBoolean>;
        isDraggable: z.ZodOptional<z.ZodBoolean>;
        maxHeight: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        fullscreen: z.ZodOptional<z.ZodBoolean>;
        isHiddenFooter: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type StructuredCrudConfig = z.infer<typeof StructuredCrudConfigSchema>;
export type FieldConfig = z.infer<typeof FieldConfigSchema>;
export type FieldRule = z.infer<typeof FieldRuleSchema>;
export {};
//# sourceMappingURL=structured-config.schema.d.ts.map