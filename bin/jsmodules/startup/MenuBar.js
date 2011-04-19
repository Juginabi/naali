if (!framework.IsHeadless())
{
    engine.ImportExtension("qt.core");
    engine.ImportExtension("qt.gui");

    var sceneAction = null;
    var assetAction = null;
    
    var mainwin = ui.MainWindow();

    var fileMenu = mainwin.AddMenu("&File");
    if (framework.GetModuleQObj("UpdateModule"))
        fileMenu.addAction(new QIcon("./data/ui/images/icon/update.ico"), "Check Updates").triggered.connect(CheckForUpdates);
    
    //fileMenu.addAction("New scene").triggered.connect(NewScene);
    
    // Reconnect menu items for client only
    if (!server.IsAboutToStart())
    {
        var disconnectAction = fileMenu.addAction(new QIcon("./data/ui/images/icon/disconnect.ico"), "Disconnect");
        disconnectAction.triggered.connect(Disconnect);
        client.Connected.connect(Connected);
        client.Disconnected.connect(Disconnected);
        Disconnected();
    }
    fileMenu.addAction(new QIcon("./data/ui/images/icon/system-shutdown.ico"), "Quit").triggered.connect(Quit);

    var viewMenu = mainwin.AddMenu("&View");
    if (framework.GetModuleQObj("CAVEStereo"))
    {
        var caveMenu = viewMenu.addMenu("&CAVE and Stereo");
        caveMenu.addAction("CAVE").triggered.connect(OpenCaveWindow);
        caveMenu.addAction("Stereoscopy").triggered.connect(OpenStereoscopyWindow);
    }

    if (framework.GetModuleQObj("SceneStructure"))
    {
        assetAction = viewMenu.addAction(new QIcon("./data/ui/images/fileIcons.png"), "Assets");
        assetAction.triggered.connect(OpenAssetsWindow);
        sceneAction = viewMenu.addAction(new QIcon("./data/ui/images/fileList.png"), "Scene");
        sceneAction.triggered.connect(OpenSceneWindow);
    }

    if (framework.GetModuleQObj("Console"))
    {
        viewMenu.addAction("Console").triggered.connect(OpenConsoleWindow);
    }

    //var eceditorAction = viewMenu.addAction("EC Editor");

    if (framework.GetModuleQObj("DebugStats"))
        viewMenu.addAction("Profiler").triggered.connect(OpenProfilerWindow);

    if (framework.GetModuleQObj("Environment"))
    {
        viewMenu.addAction("Terrain Editor").triggered.connect(OpenTerrainEditor);
        viewMenu.addAction("Post-processing").triggered.connect(OpenPostProcessWindow);
    }

    if (framework.GetModuleQObj("PythonScript"))
        viewMenu.addAction("Python Console").triggered.connect(OpenPythonConsole);
        
    var helpMenu = mainwin.AddMenu("&Help");
    helpMenu.addAction(new QIcon("./data/ui/images/icon/browser.ico"), "Wiki").triggered.connect(OpenWikiUrl);
    helpMenu.addAction(new QIcon("./data/ui/images/icon/browser.ico"), "Doxygen").triggered.connect(OpenDoxygenUrl);
    helpMenu.addAction(new QIcon("./data/ui/images/icon/browser.ico"), "Mailing list").triggered.connect(OpenMailingListUrl);
    
    client.Connected.connect(AddInworldTools);
    
    function AddInworldTools()
    {
        ui.EmitAddAction(sceneAction);
        ui.EmitAddAction(assetAction);
    }

    function NewScene() {
        scene.RemoveAllEntities();
    }

    function Reconnect() {
        client.Reconnect();
    }

    function Disconnect() {
        client.Logout();
    }

    function Connected() {
        disconnectAction.setEnabled(true);
    }

    function Disconnected() {
        disconnectAction.setEnabled(false);
    }

    function Quit() {
        framework.Exit();
    }

    function CheckForUpdates() {
        if (framework.GetModuleQObj("UpdateModule"))
            framework.GetModuleQObj("UpdateModule").RunUpdater("/checknow");
    }

    function OpenMailingListUrl() {
        QDesktopServices.openUrl(new QUrl("http://groups.google.com/group/realxtend/"));
    }
    
    function OpenWikiUrl() {
        QDesktopServices.openUrl(new QUrl("http://wiki.realxtend.org/"));
    }

    function OpenDoxygenUrl() {
        QDesktopServices.openUrl(new QUrl("http://www.realxtend.org/doxygen/"));
    }

    function OpenSceneWindow() {
        framework.GetModuleQObj("SceneStructure").ToggleSceneStructureWindow();
    }

    function OpenAssetsWindow() {
        framework.GetModuleQObj("SceneStructure").ToggleAssetsWindow();
    }

    function OpenProfilerWindow() {
        console.ExecuteCommand("prof");
    }

    function OpenTerrainEditor() {
        framework.GetModuleQObj("Environment").ShowTerrainWeightEditor();
    }

    function OpenPostProcessWindow() {
        framework.GetModuleQObj("Environment").ShowPostProcessWindow();
    }

    function OpenPythonConsole() {
        console.ExecuteCommand("pythonconsole");
    }

    function OpenConsoleWindow() {
        framework.GetModuleQObj("Console").ToggleConsole();
    }

    function OpenStereoscopyWindow() {
        framework.GetModuleQObj("CAVEStereo").ShowStereoscopyWindow();
    }

    function OpenCaveWindow() {
        framework.GetModuleQObj("CAVEStereo").ShowCaveWindow();
    }
}
