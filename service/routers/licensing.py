"""Same-machine license management; refresh tokens never reach the panel."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..auth import require_session
from ..auth import set_session_cookie
from fastapi.responses import FileResponse
from pathlib import Path
from ..licensing import LicenseError, activate_license, deactivate_license, license_status_for_helper, refresh_license

router = APIRouter(prefix='/v1/license', dependencies=[Depends(require_session)])
page_router = APIRouter()
UI_ROOT = Path(__file__).resolve().parent.parent / 'license_ui'

def license_file(name, media_type):
    response = FileResponse(UI_ROOT / name, media_type=media_type, headers={
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self'",
    })
    if name == 'index.html':
        set_session_cookie(response)
    return response

@page_router.get('/license')
@page_router.get('/license/')
def license_page():
    return license_file('index.html', 'text/html')

@page_router.get('/license/license.js')
def license_script():
    return license_file('license.js', 'text/javascript')

@page_router.get('/license/license.css')
def license_styles():
    return license_file('license.css', 'text/css')

class ActivationRequest(BaseModel):
    activationCode: str = Field(min_length=1, max_length=128)
    deviceName: str | None = Field(default=None, max_length=128)

def run(operation):
    try:
        return operation()
    except LicenseError as error:
        raise HTTPException(error.status_code, detail={'code': error.code, 'message': error.message}) from error

@router.get('/status')
def status():
    return run(license_status_for_helper)

@router.post('/activate')
def activate(body: ActivationRequest):
    return run(lambda: activate_license(body.activationCode, body.deviceName))

@router.post('/refresh')
def refresh():
    return run(refresh_license)

@router.post('/deactivate')
def deactivate():
    return run(deactivate_license)

def require_license():
    state = run(license_status_for_helper)
    if not state.get('usable'):
        raise HTTPException(403, detail={'code': 'license_required', 'message': 'Activate AE Bridge in your Pragmatic Fox account to continue.'})
