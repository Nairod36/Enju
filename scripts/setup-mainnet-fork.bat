@echo off
REM 1inch Fusion+ Cross-Chain Setup - Mainnet Fork (Windows)
REM Addresses the testnet issues mentioned in Discord

echo 🔧 Setting up Ethereum Mainnet Fork for 1inch Testing...

REM Configuration
if "%MAINNET_RPC_URL%"=="" set MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-key-here
if "%FORK_PORT%"=="" set FORK_PORT=8545
if "%FORK_BLOCK%"=="" set FORK_BLOCK=latest

REM Official 1inch addresses on mainnet
set ESCROW_FACTORY=0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a
set LIMIT_ORDER_PROTOCOL=0x11431433B0a05e9f3c0Bb99F1E37Be6f9073c6f3

echo 📋 Configuration:
echo   RPC URL: %MAINNET_RPC_URL%
echo   Fork Port: %FORK_PORT%
echo   Fork Block: %FORK_BLOCK%
echo   EscrowFactory: %ESCROW_FACTORY%
echo   LimitOrderProtocol: %LIMIT_ORDER_PROTOCOL%

REM Check if anvil is installed
where anvil >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Anvil not found. Please install Foundry:
    echo    curl -L https://foundry.paradigm.xyz ^| bash
    echo    foundryup
    pause
    exit /b 1
)

REM Kill any existing anvil processes
echo 🧹 Cleaning up existing processes...
taskkill /f /im anvil.exe >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":%FORK_PORT%" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)

REM Start mainnet fork
echo 🚀 Starting Ethereum mainnet fork...
start "Anvil Fork" anvil ^
    --fork-url %MAINNET_RPC_URL% ^
    --fork-block-number %FORK_BLOCK% ^
    --port %FORK_PORT% ^
    --host 0.0.0.0 ^
    --accounts 10 ^
    --balance 10000 ^
    --gas-limit 30000000 ^
    --code-size-limit 50000 ^
    --chain-id 31337

REM Wait for anvil to start
echo ⏳ Waiting for fork to initialize...
timeout /t 5 /nobreak >nul

REM Verify fork is working
echo 🔍 Verifying fork setup...
curl -s -X POST ^
    -H "Content-Type: application/json" ^
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}" ^
    http://localhost:%FORK_PORT% > temp_response.json

findstr "result" temp_response.json >nul
if %errorlevel% equ 0 (
    echo ✅ Fork is running successfully!
) else (
    echo ❌ Fork failed to start
    del temp_response.json
    exit /b 1
)
del temp_response.json

REM Set environment variables for this session
set MAINNET_FORK_URL=http://localhost:%FORK_PORT%
set ESCROW_FACTORY_ADDRESS=%ESCROW_FACTORY%
set LIMIT_ORDER_PROTOCOL_ADDRESS=%LIMIT_ORDER_PROTOCOL%

echo.
echo 🎉 Mainnet fork setup complete!
echo.
echo 📋 Environment Variables Set:
echo    MAINNET_FORK_URL=%MAINNET_FORK_URL%
echo    ESCROW_FACTORY_ADDRESS=%ESCROW_FACTORY_ADDRESS%
echo    LIMIT_ORDER_PROTOCOL_ADDRESS=%LIMIT_ORDER_PROTOCOL_ADDRESS%
echo.
echo 💡 Usage:
echo    - Deploy contracts: cd eth-contracts ^&^& forge script --rpc-url %MAINNET_FORK_URL%
echo    - Run tests: forge test --fork-url %MAINNET_FORK_URL%
echo    - Stop fork: taskkill /f /im anvil.exe
echo.
echo ⚠️  Note: This fork uses REAL mainnet state, including actual 1inch contracts
echo    as recommended by the 1inch team due to testnet SDK limitations.

pause