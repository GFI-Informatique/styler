/**
 * Copyright (c) 2009 Camptocamp
 */
/**
 * @requires Styler/widgets/BaseFilterPanel.js
 * @include Styler/widgets/form/SpatialComboBox.js
 * @include OpenLayers/Control/ModifyFeature.js
 * @include OpenLayers/Filter/Spatial.js
 */
Ext.namespace("Styler");
Styler.SpatialFilterPanel = Ext.extend(Styler.BaseFilterPanel, {

    /**
     * Property: comboConfig
     * {Object}
     */
    comboConfig: null,

    /**
     * Property: feature
     * {OpenLayers.Feature.Vector} feature whose geom is used by this filter
     */
    feature: null,

    /**
     * Property: map
     * {OpenLayers.Map} the map object
     */
    map: null,

    // workaround an OpenLayers bug when 2 vector layers are involved
    zindex: null,

    /**
     * Property: stateProvider
     * {Ext.state.Provider} The state provider
     * Used for storing a geometry (if available) ...
     */
    stateProvider: null,

    /**
     * Property: bufferService
     * {String} Set to the base URL of your buffer service.
     * Defaults to null, which deactivates the feature
     *
     * Note: this service should operate as https://goo.gl/1EI0TL
     */
    bufferService: null,

    /**
     * Property: toggleGroup
     * {String} the toggleGroup for the modify feature button
     */
    toggleGroup: null,

    initComponent: function() {

        var allowedTypes = [
            [OpenLayers.Filter.Spatial.INTERSECTS,
                OpenLayers.i18n("intersects")
            ]
        ];

        switch (this.feature.geometry.CLASS_NAME) {
            case "OpenLayers.Geometry.Polygon":
                allowedTypes.push([OpenLayers.Filter.Spatial.WITHIN,
                    OpenLayers.i18n("inside")
                ]);
                // "contains" does not work with MapServer version 5.6.5
                // see http://trac.osgeo.org/mapserver/ticket/2306
                // Needs more work here if we want to support both GeoServer and MapServer
                allowedTypes.push([OpenLayers.Filter.Spatial.CONTAINS,
                    OpenLayers.i18n("contains")
                ]);
                break;
            case "OpenLayers.Geometry.LineString":
                // "contains" does not work with MapServer version 5.6.5
                // see http://trac.osgeo.org/mapserver/ticket/2306
                // Needs more work here if we want to support both GeoServer and MapServer
                allowedTypes.push([OpenLayers.Filter.Spatial.CONTAINS,
                    OpenLayers.i18n("contains")
                ]);
                break;
        }

        var defComboConfig = {
            xtype: "gx_spatialcombo",
            cls: "comboConfig",
            value: this.filter.type,
            allowedTypes: allowedTypes,
            blankText: OpenLayers.i18n("This field is mandatory"),
            listeners: {
                select: function(combo, record) {
                    this.filter.type = record.get("value");
                    this.fireEvent("change", this.filter);
                },
                scope: this
            },
            width: 120

        };
        this.comboConfig = this.comboConfig || {};
        Ext.applyIf(this.comboConfig, defComboConfig);

        var ModifyFeature = OpenLayers.Control.ModifyFeature;
        this.mfControl = new ModifyFeature(
            this.feature.layer, {
                standalone: true,
                mode: ModifyFeature.RESHAPE | ModifyFeature.DRAG
            }
        );
        this.map.addControl(this.mfControl);

        Styler.SpatialFilterPanel.superclass.initComponent.call(this);
    },

    /**
     * Method: createDefaultFilter
     * May be overridden to change the default filter.
     *
     * Returns:
     * {OpenLayers.Filter} By default, returns a spatial filter.
     */
    createDefaultFilter: function() {
        return new OpenLayers.Filter.Spatial({
            value: this.feature.geometry,
            projection: this.map.getProjection()
        });
    },

    /**
     * Method: tearDown
     * To be run before panel is removed from parent.
     *
     * Returns:
     * {Boolean} By default, true to enable panel removal.
     */
    tearDown: function() {
        if (this.feature.renderIntent &&
            this.feature.renderIntent == 'select') {
            this.mfControl.unselectFeature(this.feature);
        }
        this.feature.layer.destroyFeatures([this.feature]);
        return true;
    },

    /**
     * Method: createBuffer
     * 
     */
    createBuffer: function(size) {
        var wkt = new OpenLayers.Format.WKT(),
            json = new OpenLayers.Format.JSON();
        OpenLayers.Request.POST({
            url: this.bufferService + size,
            data: wkt.write(this.feature),
            success: function(response) {
                var bWkt = json.read(response.responseText)['geometry'],
                    bGeometry = wkt.read(bWkt).geometry,
                    bFeature = new OpenLayers.Feature.Vector(bGeometry);
                this.feature.layer.addFeatures([bFeature]);
            },
            scope: this
        });
    },


    /**
     * Method: createIsochrone
     * 
     */

    createIsochrone: function(from, to, origin) {
        var map;
        if (GeoExt.MapPanel.guess().map) {
            map = GeoExt.MapPanel.guess().map;
        }



        if (this.isoWindow()) {
            this.isoWindow().close();
        }
        var el = this;

        var asupprimer = [];

        var p = new OpenLayers.Geometry.Point(origin.geometry.x, origin.geometry.y);
        var f = new OpenLayers.Feature.Vector(p);

        f.geometry.transform(from, to);

        var params = {};

        params.location = f.geometry.x + "," + f.geometry.y;
        params.epsg = "espg:4326";
        params.smoothing = true;
        params.holes = false;
        params.reverse = false;
        params.method = "time";
        params.time = 1200;
        params.graphName = "Voiture";
        params.exclusions = "";

        var url = "https://wxs.ign.fr/an7nvfzojv5wa96dsga5nk8w/isochrone/isochrone.json";

        if (!this.isoWindow().isVisible()) {
            this.isoWindow().show();
        }

        OpenLayers.Request.GET({
            url: url,
            params: params,
            callback: function(response) {
                var geomWKT = JSON.parse(response.responseText).wktGeometry;
                var features = new OpenLayers.Format.WKT().read(geomWKT);
                var layer = new Object();
                var style;

                if (GEOR.custom.ISOCHRONE_STYLE) {
                    style = new OpenLayers.StyleMap(GEOR.custom.ISOCHRONE_STYLE);

                }
                if (GeoExt.MapPanel.guess().map) {
                    var map = GeoExt.MapPanel.guess().map;
                    if (map.getLayersByName("isochrone_result").length == 1) {
                        layer = map.getLayersByName("isochrone_result")[0];
                        layer.removeAllFeatures();
                    } else {
                        var layerOptions = OpenLayers.Util.applyDefaults(
                            this.layerOptions, {
                                displayInLayerSwitcher: false,
                                projection: map.getProjectionObject(),
                                styleMap: style,
                                preFeatureInsert: function(feature) {
                                    feature.geometry.transform(to, from);
                                }
                            }
                        );
                        layer = new OpenLayers.Layer.Vector("isochrone_result", layerOptions);
                        map.addLayer(layer);
                    }

                    layer.addFeatures(features);
                }
            },
            scope: this
        });

    },


    /**
     * Method: isochroneWindow
     * 
     */
    isoWindow: function() {
        var from = new OpenLayers.Projection(GeoExt.MapPanel.guess().map.getProjection());
        var to = new OpenLayers.Projection("EPSG:4326");
        var el = this;
        var feature = this.feature;
        console.log(this.feature);

        if (Ext.getCmp("iso_window")) {
            return Ext.getCmp("iso_window");
        } else {

            // items to set mandatory params
            var mandatoryItems = [{
                xtype: "compositefield",
                id: "timeCpf",
                autoWidth: true,
                cls: "time-compositefield",
                border: false,
                items: [{
                    xtype: "numberfield",
                    id: "inputhour",
                    width: 50,
                    hideLabel: true,
                    border: false
                }, {
                    xtype: 'displayfield',
                    id: "texthour",
                    value: OpenLayers.i18n("isochrone.hour")
                }, {
                    xtype: "numberfield",
                    hideLabel: true,
                    width: 50,
                    id: "inputmin",
                    border: false,
                }, {
                    xtype: 'displayfield',
                    id: "mintext",
                    value: OpenLayers.i18n("isochrone.minutes")
                }]
            }];

            // items to set options params
            var optionItems = [{
                xtype: "fieldset",
                id: "optionFset",
                title: OpenLayers.i18n("isochrone.options.title"),
                collapsible: true,
                collapsed: true,
                items: [{
                    xtype: "compositefield",
                    id: "excludeCpf",
                    hideLabel: true,
                    items: [{
                        xtype: "checkbox",
                        id: "checkToll",
                        boxLabel: OpenLayers.i18n("isochrone.options.toll.label"),
                        hideLabel: true,

                    }, {
                        xtype: "checkbox",
                        id: "checkBridge",
                        boxLabel: OpenLayers.i18n("isochrone.options.bridge.label"),
                        hideLabel: true
                    }, {
                        xtype: "checkbox",
                        id: "checkTunnels",
                        boxLabel: OpenLayers.i18n("isochrone.options.tunnels.label"),
                        hideLabel: true
                    }]
                }, {
                    xtype: "checkbox",
                    id: "checkHoles",
                    boxLabel: OpenLayers.i18n("isochrone.options.holes.label"),
                    hideLabel: true
                }]
            }]

            // window to set isochrone params
            return new Ext.Window({
                title: OpenLayers.i18n("isochrone.window.title"),
                id: "iso_window",
                collapsible: true,
                resizable: true,
                closable: true,
                cloaseAction: "hide",
                maxWidth: 250,
                height: 300,
                buttonAlign: 'center',
                fbar: [{
                    // remove last result
                    tooltip: OpenLayers.i18n("isochrone.button.removeresult.tooltip"),
                    text: "Calculer",
                    handler: function() {
                        return el.createIsochrone(from, to, feature);
                    }
                }],
                items: [{
                    xtype: "panel",
                    id: "iso_winPanel",
                    items: [{
                        xtype: "spacer",
                        height: "5"
                    }, {
                        xtype: "compositefield",
                        id: "mandatoryCpf",
                        items: [{
                            xtype: "button",
                            text: "Piéton",
                            tooltip: OpenLayers.i18n("isochrone.pedestrian"),
                            enableToggle: true,
                            id: "pedestBtn",
                            toggleGroup: "iso_mode"
                        }, {
                            xtype: "button",
                            text: "Voiture",
                            id: "vehicleBtn",
                            tooltip: OpenLayers.i18n("isochrone.vehicle"),
                            enableToggle: true,
                            toggleGroup: "iso_mode"
                        }]
                    }, {
                        xtype: "fieldset",
                        id: "iso_itemsFset",
                        items: [mandatoryItems, {
                            xtype: "spacer",
                            height: "5"
                        }, optionItems]
                    }]
                }]
            });
        }
    },

    /**
     * Method: createFilterItems
     * Creates a panel config containing filter parts.
     */
    createFilterItems: function() {
        var el = this;
        var className = this.feature.geometry.CLASS_NAME;
        var cls = className.substr(className.lastIndexOf('.') + 1).toLowerCase();
        var width = this.comboConfig.width;
        if (this.deactivable) {
            width += 35;
        }
        // get feature and geometry **************** NEW
        var feature = this.feature;
        var geometry = feature.geometry;

        var buttonPanels = [{
            items: [{
                xtype: "button",
                iconCls: cls,
                tooltip: OpenLayers.i18n("Modify geometry"),
                enableToggle: true,
                toggleGroup: this.toggleGroup,
                listeners: {
                    "toggle": function(btn, pressed) {
                        var zindex = feature.layer.getZIndex();
                        if (pressed) {
                            if (geometry.CLASS_NAME === "OpenLayers.Geometry.Point") {
                                this.map.setCenter(
                                    geometry.getBounds().getCenterLonLat()
                                );
                            } else {
                                this.map.zoomToExtent(
                                    geometry.getBounds().scale(1.05)
                                );
                            }
                            // zindex hack (might need a rework of the handler feature 's
                            // moveLayerToTop and moveLayerBack methods to manage this)
                            this.mfControl.activate();
                            this.mfControl.selectFeature(feature);
                            feature.layer.setZIndex(this.map.Z_INDEX_BASE.Feature + 1);
                        } else {
                            this.mfControl.unselectFeature(feature);
                            this.mfControl.deactivate();
                            feature.layer.setZIndex(zindex);
                        }
                    },
                    scope: this
                }
            }]
        }];

        if (this.bufferService && OpenLayers.Format &&
            OpenLayers.Format.WKT && OpenLayers.Format.JSON) {
            buttonPanels.push({
                items: [{
                    xtype: "button",
                    iconCls: "ops",
                    tooltip: OpenLayers.i18n("Buffer"),
                    cls: 'btnSpatialFilter',
                    menu: {
                        items: [{
                            text: '10 m',
                            handler: this.createBuffer.createDelegate(this, [10])
                        }, {
                            text: '100 m',
                            handler: this.createBuffer.createDelegate(this, [100])
                        }, {
                            text: '1 km',
                            handler: this.createBuffer.createDelegate(this, [1000])
                        }, {
                            text: '10 km',
                            handler: this.createBuffer.createDelegate(this, [10000])
                        }, {
                            xtype: "numberfield",
                            emptyText: OpenLayers.i18n("Buffer size in meters"),
                            enableKeyEvents: true,
                            listeners: {
                                keyup: function(field, e) {
                                    if (e.getKey() == e.ENTER) {
                                        this.createBuffer(field.getValue());
                                    }
                                },
                                scope: this
                            }
                        }]
                    }
                }]
            });
        }

        if (this.bufferService && OpenLayers.Format &&
            OpenLayers.Format.WKT && (geometry.CLASS_NAME == "OpenLayers.Geometry.Point" || geometry.CLASS_NAME == "OpenLayers.Geometry.MultiPoint" )) {
            buttonPanels.push({
                items: [{
                    xtype: "button",
                    tooltip: OpenLayers.i18n("isochrone.button.spatialfilter"),
                    texte: "iso",
                    handler: function() {
                        var geometry = feature.geometry;
                        if (el.isoWindow().isVisible()) {
                            el.isoWindow().hide();
                        } else {
                            el.isoWindow().show();
                        }
                    }
                }]
            });
        }

        if (this.stateProvider && OpenLayers.Format && OpenLayers.Format.WKT) {
            buttonPanels.push({
                items: [{
                    xtype: "button",
                    iconCls: "savegeometry",
                    cls: 'btnSpatialFilter',
                    tooltip: OpenLayers.i18n("Save this geometry"),
                    handler: function() {
                        if (this.feature && this.feature.geometry) {
                            this.stateProvider.set('geometry',
                                this.stateProvider.encodeValue(this.feature.geometry.toString())
                            );
                            alert(OpenLayers.i18n('spatialfilterpanel.geometry.saved'));
                        }
                    },
                    scope: this
                }]
            });
        }

        return [{
            layout: 'column',
            border: false,
            defaults: {
                border: false,
            },
            items: [{
                xtype: 'compositefield', // important to keep buttons align
                border: false,
                bodyStyle: 'height:25px;',
                width: 240,
                items: [this.comboConfig, buttonPanels]
            }]
        }];
    }

});

Ext.reg('gx_spatialfilterpanel', Styler.SpatialFilterPanel);