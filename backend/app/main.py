from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
from app.database import engine
from app.routers import auth, profiles, medications, monitoring, admin

app = FastAPI(title='NeuroAdapt API', version='1.0.0', description='Academic medication tracking and authorized patient monitoring prototype.')
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])
for router in [auth.router, profiles.router, medications.router, monitoring.router, admin.router]:
    app.include_router(router, prefix='/api')


@app.middleware('http')
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Default validation errors include raw input; exclude passwords and tokens.
    return JSONResponse(status_code=422, content={'detail': [
        {'field': '.'.join(map(str, e['loc'][1:])), 'message': e['msg']} for e in exc.errors()]})


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    return JSONResponse(status_code=503, content={'detail': 'Data could not be saved or retrieved. Please try again.'})


@app.get('/api/health', tags=['Health'])
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
        return {'status': 'ok', 'database': 'connected'}
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={'status': 'unavailable', 'database': 'disconnected'})
