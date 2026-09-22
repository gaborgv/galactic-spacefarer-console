sap.ui.define([
  'sap/ui/model/json/JSONModel',
  'sap/m/MessageBox',
  'sap/m/MessageToast',
  'sap/ui/core/Fragment',
], function (JSONModel, MessageBox, MessageToast, Fragment) {
  'use strict'

  const SERVICE = '/galactic'
  const REGISTER_URL = '/galactic-spacefarers/webapp/register.html'
  const PASSWORD_FRAGMENT_ID = 'galacticChangePassword'
  const EDIT_FRAGMENT_ID = 'galacticEditProfile'

  const profileModel = new JSONModel({})
  let editDialog
  let passwordDialog
  let pageExtension

  function asBindingContext(value) {
    if (!value || typeof value !== 'object') return null
    if (typeof value.getSource === 'function' && typeof value.getId === 'function') return null
    if (typeof value.requestProperty === 'function' || typeof value.getProperty === 'function') return value
    if (typeof value.getBindingContext === 'function') return value.getBindingContext()
    return null
  }

  function getExtensionAPI(invocationThis) {
    if (typeof invocationThis?.getEditFlow === 'function') return invocationThis
    if (typeof invocationThis?.base?.getExtensionAPI === 'function') {
      return invocationThis.base.getExtensionAPI()
    }
    if (typeof pageExtension?.base?.getExtensionAPI === 'function') {
      return pageExtension.base.getExtensionAPI()
    }
    const objectPage = sap.ui.core.Component.getComponentById('SpacefarersObjectPage')
    if (typeof objectPage?.getExtensionAPI === 'function') return objectPage.getExtensionAPI()
    return null
  }

  function getContext(fallback) {
    return asBindingContext(fallback)
      ?? pageExtension?._context
      ?? pageExtension?.base?.getView?.()?.getBindingContext?.()
      ?? getExtensionAPI()?.getBindingContext?.()
      ?? null
  }

  function normalizeEmail(value) {
    return String(value ?? '').trim().toLowerCase()
  }

  function unwrapOData(payload) {
    if (!payload || typeof payload !== 'object') return payload
    if (payload.value && typeof payload.value === 'object' && !Array.isArray(payload.value) && payload.value.email) {
      return payload.value
    }
    return payload
  }

  async function fetchSession() {
    const response = await fetch(`${SERVICE}/whoAmI()`, { credentials: 'include' })
    if (!response.ok) return null
    return unwrapOData(await response.json())
  }

  async function readContextProperty(ctx, name) {
    if (!ctx) return null
    try {
      const direct = ctx.getProperty?.(name)
      if (direct != null && direct !== '') return direct
    } catch {
      // OData V4 context may require requestProperty
    }
    if (ctx.requestProperty) {
      try {
        const value = await ctx.requestProperty(name)
        if (value != null && value !== '') return value
      } catch {
        // property may be absent from the binding cache
      }
    }
    try {
      const data = ctx.requestObject
        ? await ctx.requestObject()
        : ctx.getObject?.()
      const value = data?.[name]
      if (value != null && value !== '') return value
    } catch {
      // ignore
    }
    return null
  }

  async function resolveOwnership(extension, fallbackContext) {
    if (extension?.base) pageExtension = extension
    const ctx = getContext(fallbackContext)
    let session = null
    try {
      session = await fetchSession()
    } catch {
      session = null
    }
    const profileEmail = await readContextProperty(ctx, 'email')
    const isOwn = Boolean(
      normalizeEmail(session?.email)
      && normalizeEmail(profileEmail)
      && normalizeEmail(session.email) === normalizeEmail(profileEmail)
    )

    if (pageExtension) {
      pageExtension._sessionEmail = session?.email ?? null
      pageExtension._profileEmail = profileEmail ?? null
      pageExtension._isOwnProfile = isOwn
      pageExtension._ownershipKnown = true
      pageExtension._updateCustomActionVisibility?.()
    }

    return { isOwn, session, profileEmail, ctx }
  }

  async function requireOwnProfile(fallbackContext) {
    const ownership = await resolveOwnership(pageExtension, fallbackContext)
    if (ownership.isOwn) return ownership
    if (ownership.session?.email && ownership.profileEmail) {
      MessageToast.show('You can only change your own profile')
      return null
    }
    return ownership
  }

  async function forceRelogin() {
    try {
      await fetch(`${SERVICE}/logout()`, { credentials: 'include' })
    } catch {
      // continue with hard navigation even if logout call fails
    }
    window.location.replace(`${REGISTER_URL}?relogin=${Date.now()}`)
  }

  async function patchSpacefarer(id, payload) {
    const response = await fetch(`${SERVICE}/Spacefarers(${id})`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) return
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `Request failed: ${response.status}`)
  }

  async function fetchJson(path) {
    const response = await fetch(`${SERVICE}${path}`, { credentials: 'include' })
    if (!response.ok) throw new Error(`Request failed: ${path}`)
    const payload = await response.json()
    return payload.value ?? payload
  }

  function idFromHash() {
    const match = String(window.location.hash ?? '').match(/Spacefarers\(([^)]+)\)/i)
    return match?.[1]?.replace(/^ID=/, '').replace(/['"]/g, '') ?? null
  }

  async function refreshContext(ctx) {
    if (ctx?.refresh) {
      await ctx.refresh()
      return
    }
    if (ctx?.getBinding?.()?.refresh) {
      ctx.getBinding().refresh()
    }
  }

  async function refreshListReport() {
    const app = sap.ui.core.Component.getComponentById('galactic.spacefarers')
    const model = app?.getModel?.() ?? pageExtension?.base?.getView?.()?.getModel?.()
    if (typeof model?.refresh === 'function') {
      model.refresh()
    }

    const listComponent = sap.ui.core.Component.getComponentById('SpacefarersList')
    const listApi = listComponent?.getExtensionAPI?.()
    if (typeof listApi?.refresh === 'function') {
      await listApi.refresh()
    }
  }

  async function navigateToList() {
    try {
      await refreshListReport()
    } catch {
      // still navigate even if the list refresh fails
    }

    const routing = getExtensionAPI()?.routing ?? pageExtension?.base?.getExtensionAPI?.()?.routing
    if (routing?.navigateToRoute) {
      routing.navigateToRoute('SpacefarersList', {})
      return
    }

    const component = sap.ui.core.Component.getComponentById('galactic.spacefarers')
    if (component?.getRouter?.()?.navTo) {
      component.getRouter().navTo('SpacefarersList')
      return
    }

    window.location.replace(window.location.pathname + window.location.search)
  }

  async function invokeAction(actionName, params) {
    const response = await fetch(`${SERVICE}/${actionName}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (response.ok) return
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `Request failed: ${response.status}`)
  }

  const actions = {
    bindPageExtension(extension) {
      pageExtension = extension
    },

    resolveOwnership,

    backToList() {
      navigateToList()
    },

    async editProfile(oContext) {
      try {
        const ownership = await requireOwnProfile(oContext)
        if (!ownership) return

        const ctx = ownership.ctx ?? getContext(oContext)
        const [id, stardustCollection, spacesuitColor_code] = await Promise.all([
          readContextProperty(ctx, 'ID'),
          readContextProperty(ctx, 'stardustCollection'),
          readContextProperty(ctx, 'spacesuitColor_code'),
        ])
        const profileId = id ?? idFromHash()
        if (!profileId) {
          MessageBox.error('Could not read profile')
          return
        }

        let stardust = stardustCollection
        let color = spacesuitColor_code
        if (stardust == null || !color) {
          const row = await fetchJson(`/Spacefarers(${profileId})`)
          stardust = stardust ?? row.stardustCollection
          color = color ?? row.spacesuitColor_code
        }

        const colors = await fetchJson('/SpacesuitColorOptions')
        profileModel.setData({
          ID: profileId,
          stardustCollection: stardust,
          spacesuitColor_code: color,
          colors,
        })

        if (!editDialog) {
          editDialog = await Fragment.load({
            id: EDIT_FRAGMENT_ID,
            name: 'galactic.spacefarers.view.EditProfileDialog',
            controller: actions,
          })
          editDialog.setModel(profileModel, 'profile')
        }
        editDialog.data('pageContext', ctx)
        editDialog.open()
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not open edit dialog')
      }
    },

    onEditProfileCancel() {
      editDialog?.close()
    },

    async onEditProfileSave() {
      const profile = profileModel.getData()
      const payload = {
        stardustCollection: Number(profile.stardustCollection),
        spacesuitColor_code: profile.spacesuitColor_code,
      }

      if (Number.isNaN(payload.stardustCollection) || !payload.spacesuitColor_code) {
        MessageToast.show('Complete all required fields')
        return
      }

      try {
        await patchSpacefarer(profile.ID, payload)
        editDialog.close()
        MessageToast.show('Profile updated')
        await refreshContext(editDialog.data('pageContext'))
        await refreshListReport()
      } catch (err) {
        MessageBox.error(err.message ?? 'Profile update failed')
      }
    },

    async changePassword(oContext) {
      try {
        const ownership = await requireOwnProfile(oContext)
        if (!ownership) return

        if (!passwordDialog) {
          passwordDialog = await Fragment.load({
            id: PASSWORD_FRAGMENT_ID,
            name: 'galactic.spacefarers.view.ChangePasswordDialog',
            controller: actions,
          })
        }

        Fragment.byId(PASSWORD_FRAGMENT_ID, 'oldPassword')?.setValue('')
        Fragment.byId(PASSWORD_FRAGMENT_ID, 'newPassword')?.setValue('')
        Fragment.byId(PASSWORD_FRAGMENT_ID, 'confirmPassword')?.setValue('')
        passwordDialog.open()
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not open password dialog')
      }
    },

    onPasswordDialogCancel() {
      passwordDialog?.close()
    },

    async onPasswordDialogConfirm() {
      const oldPassword = Fragment.byId(PASSWORD_FRAGMENT_ID, 'oldPassword')?.getValue?.() ?? ''
      const newPassword = Fragment.byId(PASSWORD_FRAGMENT_ID, 'newPassword')?.getValue?.() ?? ''
      const confirmPassword = Fragment.byId(PASSWORD_FRAGMENT_ID, 'confirmPassword')?.getValue?.() ?? ''

      if (!oldPassword || !newPassword) {
        MessageToast.show('Enter current and new password')
        return
      }
      if (newPassword !== confirmPassword) {
        MessageToast.show('New passwords do not match')
        return
      }

      try {
        await invokeAction('changeMyPassword', { oldPassword, newPassword })
        passwordDialog.close()
        MessageToast.show('Password updated')
      } catch (err) {
        MessageBox.error(err.message ?? 'Password change failed')
      }
    },

    async leaveAdventure(oContext) {
      try {
        const ownership = await requireOwnProfile(oContext)
        if (!ownership) return

        MessageBox.confirm('Delete your spacefarer profile? This soft-deletes your account and signs you out.', {
          title: 'Delete Spacefarer Profile',
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          emphasizedAction: MessageBox.Action.OK,
          onClose: async action => {
            if (action !== MessageBox.Action.OK) return
            const id = await readContextProperty(ownership.ctx, 'ID') ?? idFromHash()
            if (!id) {
              MessageBox.error('Could not resolve profile ID')
              return
            }
            try {
              await patchSpacefarer(id, { isDeleted: true })
              await forceRelogin()
            } catch (err) {
              MessageBox.error(err.message ?? 'Could not delete profile')
            }
          },
        })
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not delete profile')
      }
    },
  }

  return actions
})
