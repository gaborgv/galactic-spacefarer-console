sap.ui.define(['sap/ui/core/mvc/ControllerExtension'], function (ControllerExtension) {
  'use strict'

  function hideUiChrome(view) {
    if (!view) return
    view.findAggregatedObjects(true, control => {
      if (!control?.isA) return
      const text = String(control.getText?.() ?? control.getTooltip?.() ?? control.getTitle?.() ?? '')
      if (/adapt\s*filters?/i.test(text)) {
        control.setVisible(false)
        return
      }
      if (control.isA('sap.m.Button') && control.getIcon?.() === 'sap-icon://action') {
        control.setVisible(false)
      }
    })
  }

  return ControllerExtension.extend('galactic.spacefarers.ext.ListReportExt', {
    override: {
      onInit() {
        this._hideTimer = setInterval(() => hideUiChrome(this.base.getView()), 300)
        setTimeout(() => clearInterval(this._hideTimer), 15000)
      },
      onAfterRendering() {
        hideUiChrome(this.base.getView())
      },
      onExit() {
        clearInterval(this._hideTimer)
      },
    },
  })
})
