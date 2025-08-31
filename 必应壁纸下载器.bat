@echo off & setlocal EnableDelayedExpansion
color 0A & chcp 65001 >nul

set "updated=20250831" 
::控制可下载最小范围 
set "allow_download_min=20180911"
set "rversion=v1.3"
set "appName=必应壁纸下载器" 
title %appName% %rversion%
set "jsonFile=Bing_zh-CN_all.json"

:main_menu 
echo ===================================================
echo                      %appName%
echo ===================================================
call :get_date_range 
echo  可下载范围： 
echo       %min_date%- %max_date%
echo.
echo  分辨率： 
echo      [1] 原图
echo      [2] 4K       (3840x2160) 
echo      [3] 2K       (2560x1440)
echo      [4] 1080P    (1920x1080)
echo      [5] 自定义分辨率 
echo.
echo  注： 
echo      1. 20190510之前的壁纸只能下载1080P。 
echo      2. 图片数据源json下载地址：https://github.com/Zhu-junwei/bing-wallpaper-archive
echo.
set /p dpi=请输入你的选择，默认下载原图 [1-5]: 
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
pause & exit

:get_date_range
::if not exist %jsonFile% echo 缺少%jsonFile%文件，无法下载 & pause>nul & exit
if not exist %jsonFile% (
    echo 缺少图片数据源json%jsonFile%文件，尝试下载...
    echo.
	curl -L -4 -o %jsonFile% "https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/Bing_zh-CN_all.json"
    if not exist %jsonFile% (
        echo 下载失败，仍然无法找到 %jsonFile% 文件，无法继续操作。
        pause >nul
        exit
    ) else cls & goto :main_menu
)


for /f "delims=" %%a in ('powershell -nologo -command ^
    "$json = Get-Content '%jsonFile%' -Encoding UTF8 -Raw | ConvertFrom-Json;" ^
    "$dates = $json.images | ForEach-Object { $_.enddate };" ^
    "Write-Output ('min_date=' + ($dates | Sort-Object | Select-Object -First 1));" ^
    "Write-Output ('max_date=' + ($dates | Sort-Object | Select-Object -Last 1));"
') do (
    set "%%a"
)
if %min_date% lss %allow_download_min% ( set min_date=%allow_download_min% )
exit /b

:download_range
::for /f "delims=" %%I in ('powershell -Command "(Get-Date).ToString('yyyyMMdd')"') do set today=%%I
echo 当前可选下载范围[%min_date%-%max_date%]
set /p start_date=请输入开始日期，默认（%min_date%）: 
set /p end_date=请输入结束日期，默认（%max_date%）: 
if not defined start_date set "start_date=%min_date%"
if not defined end_date set "end_date=%max_date%"
if %start_date% lss  %min_date% echo 开始日期不能早于（%min_date%），请重新输入。 & goto :download_range
if %end_date% gtr %max_date% echo 结束日期不能晚于（%max_date%），请重新输入。 & goto :download_range
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
echo 解析json地址，计算下载数量…… 
set /a bCounter=0
for /f "usebackq tokens=1,* delims=@" %%A in (`powershell -nologo -command ^
		"$json = Get-Content '%jsonFile%' -Encoding UTF8 -Raw | ConvertFrom-Json;" ^
		"$images = $json.images | Where-Object { ($_.enddate -ge '%start_date%') -and ($_.enddate -le '%end_date%') };" ^
		"$images | ForEach-Object {" ^
		"	$url = if ([int]$_.enddate -lt 20190510) { $_.url } else { 'https://www.bing.com' + $_.urlbase + '_UHD.jpg&rf=LaDigue_UHD.jpg&pid=hp' };" ^
		"	$name = $_.enddate + '_' + ($_.urlbase.Substring(7)) + '.jpg';" ^
		"	Write-Output ($url + '@' + $name);" ^
		"}"`
) do (
	set /a bCounter+=1
	set "imageUrl[!bCounter!]=%%A"
	set "imageName[!bCounter!]=%%B"
)
echo 共需要下载%bCounter%张 
echo 开始下载…… 
if not exist "%downloadFolder%" mkdir "%downloadFolder%"
for /L %%i in (%bCounter%,-1,1) do (
	set /a currentIndex = !bCounter! - %%i + 1 
	title 下载： !currentIndex!/!bCounter!
	set "year=!imageName[%%i]:~0,4!"
	if not exist "%downloadFolder%\!year!" mkdir "%downloadFolder%\!year!"
	set "enddate=!imageName[%%i]:~0,8!"
	set "nw="
	if defined w if !enddate! GEQ 20190510 set "nw=!w!"
	if defined nw (
		set "imageUrl[%%i]=!imageUrl[%%i]!^&w=%w%^&h=%h%^&rs=1^&c=4"
	)
	set "savePath=%downloadFolder%\!year!\!imageName[%%i]!"
	if not exist "!savePath!" ( 
		echo 正在下载: !imageName[%%i]!
		echo 下载地址: !imageUrl[%%i]!
		curl.exe -L --progress-bar --retry 1 --connect-timeout 20 --max-time 50 -o "!savePath!" "!imageUrl[%%i]!"
	) else (
		echo 已存在: !imageName[%%i]!
	) 
)
echo 下载结束！ 
exit /b