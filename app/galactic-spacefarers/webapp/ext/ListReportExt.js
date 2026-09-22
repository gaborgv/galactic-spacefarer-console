sap.ui.define([
  'sap/ui/core/mvc/ControllerExtension',
], function (ControllerExtension) {
  'use strict'

  const SERVICE = '/galactic'

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
        this._guardAuthenticatedAccess()
      },

      onAfterRendering() {
        hideUiChrome(this.base.getView())
      },

      onExit() {
        clearInterval(this._hideTimer)
      },
    },

    async _fetchSession() {
      try {
        const response = await fetch(`${SERVICE}/whoAmI()`, { credentials: 'include' })
        if (!response.ok) return null
        return response.json()
      } catch {
        return null
      }
    },

    _guardAuthenticatedAccess() {
      this._fetchSession().then(session => {
        if (!session?.email && !this._redirectedToRegister) {
          this._redirectedToRegister = true
          window.location.href = '/galactic-spacefarers/webapp/register.html'
        }
      })
    },
  })
})
