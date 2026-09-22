sap.ui.define([
  'sap/ui/core/mvc/Controller',
  'sap/ui/model/json/JSONModel',
  'sap/m/MessageBox',
  'sap/m/MessageToast',
], function (Controller, JSONModel, MessageBox, MessageToast) {
  'use strict'

  const SERVICE = '/galactic'

  return Controller.extend('galactic.spacefarers.controller.Register', {
    onInit() {
      this._model = new JSONModel({
        name: '',
        email: '',
        password: '',
        originPlanet_code: '',
        department_ID: '',
        position_ID: '',
        navigationSkill_level: '',
        spacesuitColor_code: '',
        stardustCollection: 0,
        planets: [],
        departments: [],
        positions: [],
        skills: [],
        colors: [],
      })
      this.getView().setModel(this._model, 'register')
      this._loadPublicData()
    },

    async _fetchJson(path) {
      const response = await fetch(`${SERVICE}${path}`)
      if (!response.ok) {
        throw new Error(`Request failed: ${path}`)
      }
      const payload = await response.json()
      return payload.value ?? payload
    },

    async _loadPublicData() {
      try {
        const [planets, skills, colors] = await Promise.all([
          this._fetchJson('/Planets'),
          this._fetchJson('/NavigationSkillChoices'),
          this._fetchJson('/SpacesuitColorOptions'),
        ])
        this._model.setProperty('/planets', planets)
        this._model.setProperty('/skills', skills)
        this._model.setProperty('/colors', colors)
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not load registration data')
      }
    },

    async onPlanetChange() {
      const planet = this._model.getProperty('/originPlanet_code')
      this._model.setProperty('/department_ID', '')
      this._model.setProperty('/position_ID', '')
      this._model.setProperty('/positions', [])

      if (!planet) {
        this._model.setProperty('/departments', [])
        return
      }

      try {
        const departments = await this._fetchJson(
          `/Departments?$filter=planet_code eq '${planet}'`
        )
        this._model.setProperty('/departments', departments)
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not load departments')
      }
    },

    async onDepartmentChange() {
      const departmentId = this._model.getProperty('/department_ID')
      this._model.setProperty('/position_ID', '')

      if (!departmentId) {
        this._model.setProperty('/positions', [])
        return
      }

      try {
        const positions = await this._fetchJson(
          `/Positions?$filter=department_ID eq '${departmentId}'`
        )
        this._model.setProperty('/positions', positions)
      } catch (err) {
        MessageBox.error(err.message ?? 'Could not load positions')
      }
    },

    onSignInPress() {
      window.location.href = '/galactic-spacefarers/webapp/index.html'
    },

    async onRegisterPress() {
      const data = this._model.getData()
      const payload = {
        name: data.name?.trim(),
        email: data.email?.trim(),
        password: data.password,
        originPlanet_code: data.originPlanet_code,
        department_ID: data.department_ID,
        position_ID: data.position_ID,
        navigationSkill_level: Number(data.navigationSkill_level),
        spacesuitColor_code: data.spacesuitColor_code,
        stardustCollection: Number(data.stardustCollection ?? 0),
      }

      if (!payload.name || !payload.email || !payload.password || !payload.originPlanet_code
        || !payload.department_ID || !payload.position_ID || !payload.navigationSkill_level
        || !payload.spacesuitColor_code) {
        MessageToast.show('Complete all required fields')
        return
      }

      try {
        const response = await fetch(`${SERVICE}/registerSpacefarer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error?.message ?? 'Registration failed')
        }

        MessageBox.success(
          `Welcome aboard, ${payload.name}! Sign in with your email and password to view your planet dashboard.`,
          { onClose: () => this.onSignInPress() }
        )
      } catch (err) {
        MessageBox.error(err.message ?? 'Registration failed')
      }
    },
  })
})
