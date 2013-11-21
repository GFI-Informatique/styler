/**
 * Copyright (c) 2008 The Open Planning Project
 */

/**
 * @requires Styler/widgets/FilterPanel.js
 * @requires OpenLayers/Filter/Comparison.js
 */

Ext.namespace("Styler.form");
Styler.form.ComparisonComboBox = Ext.extend(Ext.form.ComboBox, {

    allowedTypes: [
        [Styler.FilterPanel.CONTAINS, "contains"],
        [OpenLayers.Filter.Comparison.EQUAL_TO, "="],
        [OpenLayers.Filter.Comparison.NOT_EQUAL_TO, "<>"],
        [OpenLayers.Filter.Comparison.LESS_THAN, "<"],
        [OpenLayers.Filter.Comparison.GREATER_THAN, ">"],
        [OpenLayers.Filter.Comparison.LESS_THAN_OR_EQUAL_TO, "<="],
        [OpenLayers.Filter.Comparison.GREATER_THAN_OR_EQUAL_TO, ">="],
        [OpenLayers.Filter.Comparison.LIKE, "like"]
    ],

    allowBlank: false,

    mode: "local",

    triggerAction: "all",

    width: 50,

    editable: false,

    initComponent: function() {
        // localised
        Ext.each(this.allowedTypes, function(allowedType) {
            allowedType[1] = OpenLayers.i18n(allowedType[1])
        })

        var defConfig = {
            displayField: "name",
            valueField: "value",
            store: new Ext.data.SimpleStore({
                fields: ["value", "name"],
                data: this.allowedTypes
            }),
            mode: 'local',
            lastQuery: '',
            value: (this.value === undefined) ? this.allowedTypes[0][0] : this.value
        };
        Ext.applyIf(this, defConfig);

        Styler.form.ComparisonComboBox.superclass.initComponent.call(this);
    }
});

Ext.reg("gx_comparisoncombo", Styler.form.ComparisonComboBox);
