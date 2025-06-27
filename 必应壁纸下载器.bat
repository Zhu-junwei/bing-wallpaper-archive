@echo off & setlocal EnableDelayedExpansion
color 0A & chcp 65001 >nul

set "updated=20250625" 
set "rversion=v1.1"
set "appName=必应壁纸下载器" 
title %appName% %rversion%
set min_date=20200101
set max_date=20250625
set "jsonFile=Bing_zh-CN_all.json"

:main_menu 
echo ================================
echo          %appName%
echo ================================
echo.
echo   [1] 原图尺寸
echo   [2] 4K       (3840x2160) 
echo   [3] 2K       (2560x1440)
echo   [4] 1080P    (1920x1080)
echo   [5] 自定义分辨率 
echo.
set /p dpi=请输入你的选择，默认原始尺寸 [1-5]: 
::if "%dpi%"=="1"  
if "%dpi%"=="2"  set "w=3840" & set "h=2160"
if "%dpi%"=="3"  set "w=2560" & set "h=1440"
if "%dpi%"=="4"  set "w=1920" & set "h=1080"
if "%dpi%"=="5"  (
	:set_custom_dpi
	set /p w=请输入自定义宽度（如3840）:
	set /p h=请输入自定义高度（如2160）:
	if not defined w goto :set_custom_dpi
	if not defined h goto :set_custom_dpi
)
echo.
call :download_range
echo 设置下载范围 %start_date%-%end_date%
echo.
call :download_Folder
echo 设置下载位置%downloadFolder%
echo.
call :download_start
pause & exit /b

:download_range
for /f "delims=" %%I in ('powershell -Command "(Get-Date).ToString('yyyyMMdd')"') do set today=%%I
echo 下载日期范围选择，格式：YYYYMMDD，范围[%min_date%-%today%]
set /p start_date=请输入开始日期，默认（%min_date%）: 
set /p end_date=请输入结束日期，默认（%today%）: 
if not defined start_date set "start_date=%min_date%"
if not defined end_date set "end_date=%today%"
if %start_date% lss  %min_date% echo 开始日期不能早于（%min_date%），请重新输入。 & goto :download_range
if %end_date% gtr %today% echo 结束日期不能晚于（%today%），请重新输入。 & goto :download_range
exit /b

:download_Folder
for /f "usebackq delims=" %%P in (`powershell -nologo -noprofile -command "[Environment]::GetFolderPath('Desktop')"`) do (
	set "tempBingWallpaperPath=%%P\必应壁纸"
)
echo 默认下载位置：%tempBingWallpaperPath%
set /p "input=是否更改下载位置[y/N]:"
if /i "%input%"=="y" (
	for /f "usebackq delims=" %%i in (
		`powershell -noprofile -command "$shell=New-Object -ComObject Shell.Application; $folder=$shell.BrowseForFolder(0,'请选择必应壁纸下载位置',0,0); if($folder){$folder.Self.Path}"`
	) do set "downloadFolder=%%i"
)
if not defined downloadFolder set "downloadFolder=%tempBingWallpaperPath%"
exit /b

:download_start
echo 开始下载…… 
set /a bCounter=0
for /f "usebackq tokens=1,* delims=@" %%A in (`powershell -nologo -command ^
		"$json = Get-Content '%jsonFile%' -Encoding UTF8 -Raw | ConvertFrom-Json;" ^
		"$images = $json.images | Where-Object { ($_.enddate -ge '%start_date%') -and ($_.enddate -le '%end_date%') };" ^
		"$images | ForEach-Object {" ^
		"    Write-Output ($_.urlbase + '@' + $_.enddate + '_' + ($_.urlbase.Substring(7)) + '.jpg');" ^
		"}"`
) do (
	set /a bCounter+=1
	set "imageUrl[!bCounter!]=%%A"
	set "imageName[!bCounter!]=%%B"
)
if not exist "%downloadFolder%" mkdir "%downloadFolder%"
for /L %%i in (%bCounter%,-1,1) do (
	set /a currentIndex = !bCounter! - %%i + 1 
	title 下载： !currentIndex!/!bCounter!
	if defined w (
		set "imageUrl[%%i]=!imageUrl[%%i]!_UHD.jpg^&rf=LaDigue_UHD.jpg^&pid=hp^&w=%w%^&h=%h%^&rs=1^&c=4"
	) else ( 
		set "imageUrl[%%i]=!imageUrl[%%i]!_UHD.jpg^&rf=LaDigue_UHD.jpg^&pid=hp"
	)
	set "savePath=%downloadFolder%\!imageName[%%i]!"
	if not exist "!savePath!" ( 
		echo 正在下载: !imageName[%%i]!
		echo 下载地址: https://www.bing.com!imageUrl[%%i]!
		curl.exe -L --progress-bar --retry 1 --connect-timeout 10 --max-time 50 -o "!savePath!" "https://www.bing.com!imageUrl[%%i]!"
	) else (
		echo 已存在: !imageName[%%i]!
	) 
)
echo 下载结束！ 
pause & goto :main_menu