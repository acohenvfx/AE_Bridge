(() => {
  'use strict'

  const elements = {
    form: document.querySelector('#activation-form'),
    code: document.querySelector('#activation-code'),
    activate: document.querySelector('#activate-button'),
    details: document.querySelector('#license-details'),
    actions: document.querySelector('#device-actions'),
    refresh: document.querySelector('#refresh-button'),
    deactivate: document.querySelector('#deactivate-button'),
    statusCopy: document.querySelector('#status-copy'),
    stateDot: document.querySelector('#state-dot'),
    stateLabel: document.querySelector('#state-label'),
    plan: document.querySelector('#plan-value'),
    expiry: document.querySelector('#expiry-value'),
    device: document.querySelector('#device-value'),
    message: document.querySelector('#message'),
  }

  const ACTIVE_STATES = new Set(['active', 'trialing'])
  let pendingActivationCode = new URLSearchParams(window.location.hash.slice(1)).get('activation')?.trim() || ''
  if (pendingActivationCode) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
  }

  function setBusy(busy, label) {
    elements.activate.disabled = busy
    elements.refresh.disabled = busy
    elements.deactivate.disabled = busy
    if (label) elements.statusCopy.textContent = label
  }

  function showMessage(message) {
    elements.message.textContent = message || ''
    elements.message.hidden = !message
  }

  function titleCase(value) {
    return String(value || 'unknown')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function formatExpiry(epochSeconds) {
    if (!Number.isFinite(epochSeconds)) return 'Unavailable'
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(epochSeconds * 1000))
  }

  function render(state) {
    const name = state && state.state ? state.state : 'unknown'
    const active = ACTIVE_STATES.has(name)
    const configured = name !== 'not_configured'

    elements.stateDot.className = `state-dot ${active ? 'is-active' : configured ? 'is-warning' : 'is-error'}`
    elements.stateLabel.textContent = titleCase(name)
    elements.form.hidden = active || !configured
    elements.details.hidden = !active
    elements.actions.hidden = !active

    if (active) {
      elements.statusCopy.textContent = name === 'trialing'
        ? 'Your trial is active on this Mac.'
        : 'AE Bridge is activated on this Mac.'
      elements.plan.textContent = titleCase(name)
      elements.expiry.textContent = formatExpiry(state.expiresAt)
      elements.device.textContent = state.deviceId || 'This Mac'
    } else if (name === 'not_activated' || name === 'lease_missing') {
      elements.statusCopy.textContent = 'Enter an activation code to connect this Mac to your subscription.'
    } else if (name === 'not_configured') {
      elements.statusCopy.textContent = 'Licensing is not configured in this helper build.'
    } else {
      elements.statusCopy.textContent = 'This license needs attention. Enter a new activation code or refresh your account.'
    }
  }

  async function request(path, options) {
    const response = await fetch(path, options)
    let body = null
    try { body = await response.json() } catch (_error) {}
    if (!response.ok) {
      const detail = body && body.detail
      const message = detail && typeof detail === 'object' ? detail.message : detail
      throw new Error(message || `Request failed (${response.status})`)
    }
    return body
  }

  function submitPendingActivation() {
    if (!pendingActivationCode) return
    const activationCode = pendingActivationCode
    pendingActivationCode = ''
    elements.code.value = activationCode
    elements.form.requestSubmit()
  }

  async function loadStatus() {
    showMessage('')
    try {
      const state = await request('/v1/license/status')
      render(state)
      if (pendingActivationCode && state.state !== 'not_configured' && !ACTIVE_STATES.has(state.state)) {
        submitPendingActivation()
      }
    } catch (error) {
      render({ state: 'unavailable' })
      if (pendingActivationCode) {
        elements.code.value = pendingActivationCode
        showMessage(`${error.message}. Click Activate to retry.`)
      } else {
        showMessage(error.message)
      }
    }
  }

  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const activationCode = elements.code.value.trim()
    if (!activationCode) return
    showMessage('')
    setBusy(true, 'Activating this Mac…')
    try {
      const state = await request('/v1/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activationCode }),
      })
      elements.code.value = ''
      render(state)
    } catch (error) {
      showMessage(error.message)
    } finally {
      setBusy(false)
    }
  })

  elements.refresh.addEventListener('click', async () => {
    showMessage('')
    setBusy(true, 'Refreshing your license…')
    try { render(await request('/v1/license/refresh', { method: 'POST' })) }
    catch (error) { showMessage(error.message) }
    finally { setBusy(false) }
  })

  elements.deactivate.addEventListener('click', async () => {
    if (!window.confirm('Deactivate AE Bridge on this Mac?')) return
    showMessage('')
    setBusy(true, 'Deactivating this Mac…')
    try {
      const result = await request('/v1/license/deactivate', { method: 'POST' })
      render({ state: 'not_activated' })
      showMessage(result && result.alreadyDeactivated
        ? 'This Mac was already deactivated. Its local license data has been cleared.'
        : 'This Mac has been deactivated.')
    } catch (error) { showMessage(error.message) }
    finally { setBusy(false) }
  })

  loadStatus()
})()
