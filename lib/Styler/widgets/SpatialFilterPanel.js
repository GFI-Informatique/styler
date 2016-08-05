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

        var allowedTypes = [[OpenLayers.Filter.Spatial.INTERSECTS,
            OpenLayers.i18n("intersects")]];

        switch (this.feature.geometry.CLASS_NAME) {
            case "OpenLayers.Geometry.Polygon":
                allowedTypes.push([OpenLayers.Filter.Spatial.WITHIN,
                    OpenLayers.i18n("inside")]);
                // "contains" does not work with MapServer version 5.6.5
                // see http://trac.osgeo.org/mapserver/ticket/2306
                // Needs more work here if we want to support both GeoServer and MapServer
                allowedTypes.push([OpenLayers.Filter.Spatial.CONTAINS,
                    OpenLayers.i18n("contains")]);
                break;
            case "OpenLayers.Geometry.LineString":
                // "contains" does not work with MapServer version 5.6.5
                // see http://trac.osgeo.org/mapserver/ticket/2306
                // Needs more work here if we want to support both GeoServer and MapServer
                allowedTypes.push([OpenLayers.Filter.Spatial.CONTAINS,
                    OpenLayers.i18n("contains")]);
                break;
        }

        var defComboConfig = {
            xtype: "gx_spatialcombo",
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
     * Method: createFilterItems
     * Creates a panel config containing filter parts.
     */
    createFilterItems: function() {
        var className = this.feature.geometry.CLASS_NAME;
        var cls = className.substr(className.lastIndexOf('.')+1).toLowerCase();
        var width = this.comboConfig.width;
        if (this.deactivable) {
            width += 35;
        }

        var buttonPanels = [{
            items: [{
                xtype: "button",
                iconCls: cls,
                tooltip: OpenLayers.i18n("Modify geometry"),
                enableToggle: true,
                toggleGroup: this.toggleGroup,
                listeners: {
                    "toggle": function(btn, pressed) {
                        var feature = this.feature;
                        if (pressed) {
                            var geometry = feature.geometry;
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
                            zindex = feature.layer.getZIndex();
                            this.mfControl.activate();
                            this.mfControl.selectFeature(feature);
                            feature.layer.setZIndex(this.map.Z_INDEX_BASE.Feature+1);
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

        if (this.bufferService && OpenLayers.Format
            && OpenLayers.Format.WKT && OpenLayers.Format.JSON) {
            buttonPanels.push({
            	 items: [{
            	     xtype: "button",
                 	 iconCls: "ops",
                     tooltip: OpenLayers.i18n("Buffer"),
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
                             listeners: {
                                 "specialkey": function(field, e){
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

        if (this.stateProvider && OpenLayers.Format && OpenLayers.Format.WKT) {
            buttonPanels.push({
                items: [{
                    xtype: "button",
                    iconCls: "savegeometry",
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
            layout: "column",
            border: false,
            defaults: {
                border: false
            },
            items: [{
                items: [{
                    width: this.comboConfig.width,
                    border: false,
                    items: [this.comboConfig]
                }]
            }, {
                defaults: {
                    border: false,
                    bodyStyle: 'padding-left:.5em;'
                },
                items: buttonPanels
            }]
        }];
    }

});

Ext.reg('gx_spatialfilterpanel', Styler.SpatialFilterPanel);
