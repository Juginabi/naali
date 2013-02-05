if (!server.IsRunning())
{
    client.switchScene.connect(changeScene);

    function changeScene(name)
    {
        var targetScene = framework.Scene().GetScene(name);
        if (targetScene)
        {
            var cameraentity = scene.GetEntityByName("AvatarCamera");
            if (!cameraentity)
            {
                cameraentity = scene.GetEntityByName("PortalCamera");
                if (cameraentity == null)
                {
                    cameraentity = scene.GetEntityByName("FreeLookCamera");
                }
            }
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
