if (!server.IsRunning())
{
    client.switchScene.connect(changeScene);

    function changeScene(name)
    {
        print("Multiconnection.js: Scene switch! Switching to: " + name);
        var targetScene = framework.Scene().GetScene(name);
        if (targetScene)
        {

            var cameraentity = targetScene.GetEntityByName("AvatarCamera");
            if (cameraentity == null)
                cameraentity = targetScene.GetEntityByName("FreeLookCamera");
            if (cameraentity)
            {
                var camera = cameraentity.camera;
                if (camera)
                    camera.SetActive(camera);
                else
                    print("Unable to set camera active for scene: " + targetScene.name);
            }
        }
    }
}
