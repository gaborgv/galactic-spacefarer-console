sap.ui.define([
  'sap/ui/core/mvc/ControllerExtension',
  'galactic/spacefarers/ext/ObjectPageActions',
], function (ControllerExtension, ObjectPageActions) {
  'use strict'

  const OWN_PROFILE_LABELS = {
    'Edit Profile': true,
    'Change Password': true,
    'Delete Spacefarer Profile': true,
  }

  function isOwnProfileAction(control) {
    const id = String(control.getId?.() ?? '')
    if (/EditProfile|ChangePassword|LeaveAdventure/.test(id)) return true
    const text = String(control.getText?.() ?? '').trim()
    return Boolean(OWN_PROFILE_LABELS[text])
  }

  function isPageEditable(view) {
    const ui = view?.getModel?.('ui')
    return Boolean(ui?.getProperty?.('/isEditable') || ui?.getProperty?.('/editable'))
  }

  function hideUiChrome(view) {
    if (!view) return
    view.findAggregatedObjects(true, control => {
      if (!control?.isA) return
      const id = String(control.getId?.() ?? '')
      if (id.includes('StandardAction::Delete') || id.includes('StandardAction::DeleteEntity')) {
        control.setVisible(false)
        return
      }
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

  function hideStandardEdit(view) {
    if (!view) return
    view.findAggregatedObjects(true, control => {
      if (!control?.isA('sap.m.Button')) return
      const text = String(control.getText?.() ?? '').trim()
      if (/^edit$/i.test(text)) {
        control.setVisible(false)
      }
    })
  }

  return ControllerExtension.extend('galactic.spacefarers.ext.ObjectPageExt', {
    override: {
      onInit() {
        ObjectPageActions.bindPageExtension(this)
        this._isOwnProfile = false
        this._ownershipKnown = false
        this._sessionEmail = null
        this._profileEmail = null
        this._hideTimer = setInterval(() => {
          hideUiChrome(this.base.getView())
          this._updateCustomActionVisibility()
        }, 300)
      },

      onAfterRendering() {
        hideUiChrome(this.base.getView())
        hideStandardEdit(this.base.getView())
        this._updateCustomActionVisibility()
      },

      onExit() {
        clearInterval(this._hideTimer)
      },

      routing: {
        async onAfterBinding(oContext) {
          this._context = oContext
          await ObjectPageActions.resolveOwnership(this, oContext)
        },
      },
    },

    _updateCustomActionVisibility() {
      const view = this.base.getView()
      hideStandardEdit(view)
      if (!this._ownershipKnown) return

      const editing = isPageEditable(view)
      view.findAggregatedObjects(true, control => {
        if (!control?.isA('sap.m.Button')) return
        if (!isOwnProfileAction(control)) return
        control.setVisible(this._isOwnProfile && !editing)
      })
    },
  })
})
