sap.ui.define([
  'sap/ui/core/mvc/ControllerExtension',
  'sap/ui/model/json/JSONModel',
  'sap/m/MessageBox',
  'sap/m/MessageToast',
  'sap/m/Button',
  'sap/ui/core/Fragment',
], function (ControllerExtension, JSONModel, MessageBox, MessageToast, Button, Fragment) {
  'use strict'

  const SERVICE = '/galactic'

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

  function hideEditControls(view) {
    if (!view) return
    view.findAggregatedObjects(true, control => {
      if (!control?.isA('sap.m.Button')) return
      const text = String(control.getText?.() ?? '')
      if (/^edit$/i.test(text.trim())) {
        control.setVisible(false)
      }
    })
  }

  return ControllerExtension.extend('galactic.spacefarers.ext.ObjectPageExt', {
    override: {
      onInit() {
        this._session = null
        this._isOwnProfile = false
        this._headerButtonsReady = false
        this._profileModel = new JSONModel({})
        this._hideTimer = setInterval(() => hideUiChrome(this.base.getView()), 300)
        setTimeout(() => clearInterval(this._hideTimer), 15000)
      },

      onAfterRendering() {
        hideUiChrome(this.base.getView())
        hideEditControls(this.base.getView())
        this._refreshOwnershipUi()
      },

      onExit() {
        clearInterval(this._hideTimer)
      },

      editFlow: {
        onBeforeEdit() {
          return false
        },
      },

      routing: {
        async onAfterBinding(oContext) {
          await this._resolveOwnership(oContext)
          this._ensureHeaderButtons()
          this._refreshOwnershipUi()
        },
      },
    },

    async _fetchJson(path) {
      const response = await fetch(`${SERVICE}${path}`, { credentials: 'include' })
      if (!response.ok) throw new Error(`Request failed: ${path}`)
      const payload = await response.json()
      return payload.value ?? payload
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

    async _resolveOwnership(oContext) {
      this._session = await this._fetchSession()
      const email = oContext?.getProperty?.('email')
      this._isOwnProfile = Boolean(this._session?.email && email === this._session.email)
    },

    _ensureHeaderButtons() {
      if (this._headerButtonsReady) return

      const view = this.base.getView()
      const headerTitle = view?.getHeaderTitle?.()
      if (!headerTitle?.addAction) return

      this._editBtn = new Button({
        text: 'Edit Profile',
        type: 'Emphasized',
        press: () => this.onEditProfilePress(),
        visible: false,
      })
      headerTitle.addAction(this._editBtn)

      this._passwordBtn = new Button({
        text: 'Change Password',
        type: 'Transparent',
        press: () => this.onChangePasswordPress(),
        visible: false,
      })
      headerTitle.addAction(this._passwordBtn)

      this._deleteBtn = new Button({
        text: 'Leave Adventure',
        type: 'Transparent',
        press: () => this.onSoftDeletePress(),
        visible: false,
      })
      headerTitle.addAction(this._deleteBtn)

      this._headerButtonsReady = true
    },

    _refreshOwnershipUi() {
      const view = this.base.getView()
      hideUiChrome(view)
      hideEditControls(view)

      if (this._editBtn) this._editBtn.setVisible(this._isOwnProfile)
      if (this._passwordBtn) this._passwordBtn.setVisible(this._isOwnProfile)
      if (this._deleteBtn) this._deleteBtn.setVisible(this._isOwnProfile)
    },

    async onEditProfilePress() {
      if (!this._isOwnProfile) return

      const context = this.base.getView().getBindingContext()
      const data = context.getObject()
      const planet = data.originPlanet_code

      try {
        const [colors, skills, departments] = await Promise.all([
          this._fetchJson('/SpacesuitColorOptions'),
          this._fetchJson('/NavigationSkillChoices'),
          this._fetchJson(`/Departments?$filter=planet_code eq '${planet}'`),
        ])
        const positions = data.department_ID
          ? await this._fetchJson(`/Positions?$filter=department_ID eq '${data.department_ID}'`)
          : []

        this._profileModel.setData({
          ID: data.ID,
          name: data.name,
          stardustCollection: data.stardustCollection,
          spacesuitColor_code: data.spacesuitColor_code,
          navigationSkill_level: String(data.navigationSkill_level),
          department_ID: data.department_ID,
          position_ID: data.position_ID,
          originPlanet_code: planet,
          colors,
          skills,
          departments,
          positions,
        })
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not load profile options')
        return
      }

      const view = this.base.getView()
      if (!this._editDialog) {
        this._editDialog = await Fragment.load({
          id: view.getId(),
          name: 'galactic.spacefarers.view.EditProfileDialog',
          controller: this,
        })
        this._editDialog.setModel(this._profileModel, 'profile')
        view.addDependent(this._editDialog)
      }
      this._editDialog.open()
    },

    async onEditDepartmentChange() {
      const departmentId = this._profileModel.getProperty('/department_ID')
      this._profileModel.setProperty('/position_ID', '')
      if (!departmentId) {
        this._profileModel.setProperty('/positions', [])
        return
      }
      try {
        const positions = await this._fetchJson(`/Positions?$filter=department_ID eq '${departmentId}'`)
        this._profileModel.setProperty('/positions', positions)
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not load positions')
      }
    },

    onEditProfileCancel() {
      this._editDialog?.close()
    },

    async onEditProfileSave() {
      const profile = this._profileModel.getData()
      const payload = {
        name: profile.name?.trim(),
        stardustCollection: Number(profile.stardustCollection),
        spacesuitColor_code: profile.spacesuitColor_code,
        navigationSkill_level: Number(profile.navigationSkill_level),
        department_ID: profile.department_ID,
        position_ID: profile.position_ID,
      }

      if (!payload.name || !payload.spacesuitColor_code || !payload.department_ID || !payload.position_ID) {
        MessageToast.show('Complete all required fields')
        return
      }

      try {
        const response = await fetch(`${SERVICE}/Spacefarers(${profile.ID})`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? 'Profile update failed')
        }
        this._editDialog.close()
        MessageToast.show('Profile updated')
        const context = this.base.getView().getBindingContext()
        await context.requestObject()
        context.refresh()
      } catch (err) {
        MessageBox.error(err.message ?? 'Profile update failed')
      }
    },

    async onChangePasswordPress() {
      if (!this._isOwnProfile) return

      const view = this.base.getView()
      if (!this._passwordDialog) {
        this._passwordDialog = await Fragment.load({
          id: view.getId(),
          name: 'galactic.spacefarers.view.ChangePasswordDialog',
          controller: this,
        })
        view.addDependent(this._passwordDialog)
      }

      Fragment.byId(view.getId(), 'oldPassword')?.setValue('')
      Fragment.byId(view.getId(), 'newPassword')?.setValue('')
      Fragment.byId(view.getId(), 'confirmPassword')?.setValue('')
      this._passwordDialog.open()
    },

    onPasswordDialogCancel() {
      this._passwordDialog?.close()
    },

    async onPasswordDialogConfirm() {
      const view = this.base.getView()
      const oldPassword = Fragment.byId(view.getId(), 'oldPassword')?.getValue?.() ?? ''
      const newPassword = Fragment.byId(view.getId(), 'newPassword')?.getValue?.() ?? ''
      const confirmPassword = Fragment.byId(view.getId(), 'confirmPassword')?.getValue?.() ?? ''

      if (!oldPassword || !newPassword) {
        MessageToast.show('Enter current and new password')
        return
      }
      if (newPassword !== confirmPassword) {
        MessageToast.show('New passwords do not match')
        return
      }

      try {
        const response = await fetch(`${SERVICE}/changeMyPassword`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPassword, newPassword }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? 'Password change failed')
        }
        this._passwordDialog.close()
        MessageToast.show('Password updated')
      } catch (err) {
        MessageBox.error(err.message ?? 'Password change failed')
      }
    },

    onSoftDeletePress() {
      if (!this._isOwnProfile) return

      MessageBox.confirm('Leave the Galactic Adventure? Your profile will be soft-deleted.', {
        title: 'Leave Adventure',
        onClose: action => {
          if (action === MessageBox.Action.OK) this._softDeleteProfile()
        },
      })
    },

    async _softDeleteProfile() {
      const context = this.base.getView().getBindingContext()
      const id = context?.getProperty('ID')
      if (!id) return

      try {
        const response = await fetch(`${SERVICE}/Spacefarers(${id})`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDeleted: true }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? 'Could not delete profile')
        }
        MessageToast.show('Profile removed')
        this.base.getRouter().navTo('SpacefarersList')
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not delete profile')
      }
    },
  })
})
