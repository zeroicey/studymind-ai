@echo off
echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Running tests...
pytest -v --capture=no

echo.
echo Tests completed.
pause
