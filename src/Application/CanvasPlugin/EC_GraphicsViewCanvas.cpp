/**
    For conditions of distribution and use, see copyright notice in LICENSE

    @file   EC_GraphicsViewCanvas.cpp
    @brief  Makes possible to to embed arbitrary Qt UI elements into a 3D model. */

#define MATH_OGRE_INTEROP

#include "EC_GraphicsViewCanvas.h"

#include "AssetAPI.h"
#include "Renderer.h"
#include "OgreRenderingModule.h"
#include "UiAPI.h"
#include "UiGraphicsView.h"
#include "Scene/Scene.h"
#include "Framework.h"
#include "MouseEvent.h"
#include "KeyEvent.h"
#include "TextureAsset.h"
#include "RedirectedPaintWidget.h"
#include "LoggingFunctions.h"
#include "Geometry/Ray.h"
#include "Entity.h"
#include "EC_Camera.h"
#include "EC_Mesh.h"
#include "InputAPI.h"
#include "OgreWorld.h"
#include "Profiler.h"
#include "OgreMaterialAsset.h"

#include <Ogre.h>

#include <QApplication>
#include <QtGui>

EC_GraphicsViewCanvas::EC_GraphicsViewCanvas(Scene *scene) :
    IComponent(scene),
    outputTexture(this, "Output texture"),
    width(this, "Texture width"),
    height(this, "Texture height"),
    submesh(this, "Submesh", 0),
    graphicsScene(0),
    graphicsView(0),
    paintTarget(0),
    isActivated(false)
{
    graphicsView = new QGraphicsView();
    graphicsScene = new QGraphicsScene();
    graphicsView->setScene(graphicsScene);
    paintTarget = new RedirectedPaintWidget();
    paintTarget->setAttribute(Qt::WA_DontShowOnScreen, true);
    graphicsView->setViewport(paintTarget); // graphicsView takes ownership of the paintTarget viewport widget.
    graphicsView->setAttribute(Qt::WA_DontShowOnScreen, true);
    graphicsView->show();

    connect(graphicsScene, SIGNAL(changed(const QList<QRectF> &)), this, SLOT(OnGraphicsSceneChanged(const QList<QRectF> &)), Qt::UniqueConnection);

    graphicsView->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    graphicsView->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    graphicsView->setLineWidth(0);

    inputContext = GetFramework()->Input()->RegisterInputContext("EC_GraphicsViewCanvas", 1000);
    connect(inputContext.get(), SIGNAL(MouseEventReceived(MouseEvent*)), this, SLOT(OnMouseEventReceived(MouseEvent*)));
    connect(inputContext.get(), SIGNAL(KeyEventReceived(KeyEvent*)), this, SLOT(OnKeyEventReceived(KeyEvent*)));

    if (!framework->IsHeadless())
    {
        UiGraphicsView *gv = framework->Ui()->GraphicsView();
        connect(gv, SIGNAL(DragEnterEvent(QDragEnterEvent *, QGraphicsItem *)), SLOT(OnDragEnterEvent(QDragEnterEvent *)), Qt::UniqueConnection);
        connect(gv, SIGNAL(DragLeaveEvent(QDragLeaveEvent *)), SLOT(OnDragLeaveEvent(QDragLeaveEvent *)), Qt::UniqueConnection);
        connect(gv, SIGNAL(DragMoveEvent(QDragMoveEvent *, QGraphicsItem *)), SLOT(OnDragMoveEvent(QDragMoveEvent *)), Qt::UniqueConnection);
        connect(gv, SIGNAL(DropEvent(QDropEvent *, QGraphicsItem *)), SLOT(OnDropEvent(QDropEvent *)), Qt::UniqueConnection);
    }

    connect(this, SIGNAL(ParentEntitySet()), this, SLOT(UpdateSignals()));
}

EC_GraphicsViewCanvas::~EC_GraphicsViewCanvas()
{
    defaultMaterialAssets.clear();
    SAFE_DELETE(graphicsScene);
    SAFE_DELETE(graphicsView);
}

void EC_GraphicsViewCanvas::UpdateSignals()
{
    Entity* parent = ParentEntity();
    if (parent)
    {
        connect(parent, SIGNAL(ComponentAdded(IComponent*, AttributeChange::Type)), SLOT(UpdateTexture()), Qt::UniqueConnection);

        EC_Mesh *mesh = ParentEntity()->GetComponent<EC_Mesh>().get();
        if (mesh)
        {
            connect(mesh, SIGNAL(MeshChanged()), this, SLOT(UpdateTexture()), Qt::UniqueConnection);
            connect(mesh, SIGNAL(MaterialChanged(uint, const QString &)), this, SLOT(OnMaterialChanged(uint, const QString &)), Qt::UniqueConnection);

            UpdateTexture();
        }
    }
}

void EC_GraphicsViewCanvas::OnGraphicsSceneChanged(const QList<QRectF> &)
{
    UpdateTexture();
}

void EC_GraphicsViewCanvas::AttributesChanged()
{
    if (outputTexture.ValueChanged())
    {
        AssetPtr canvasSurface = framework->Asset()->GetAsset(outputTexture.Get());
        if (!canvasSurface && !framework->IsHeadless())
        {
            canvasSurface = framework->Asset()->CreateNewAsset("Texture", outputTexture.Get());
            if (!canvasSurface)
                ::LogError("Failed to create texture \"" + outputTexture.Get() + "\" for EC_GraphicsViewCanvas!");
        }
    }
    if (width.ValueChanged() || height.ValueChanged())
    {
        graphicsView->resize(width.Get(), height.Get());
        paintTarget->target = QImage(width.Get(), height.Get(), QImage::Format_ARGB32);
        paintTarget->target.fill(0);
    }
}

bool EC_GraphicsViewCanvas::IsMouseOnTopOfMainUI()
{
    QPoint mousePos = GetFramework()->Input()->MousePos();
    QGraphicsItem *itemUnderMouse = GetFramework()->Ui()->GraphicsView()->VisibleItemAtCoords(mousePos.x(), mousePos.y());
    return (itemUnderMouse != 0 && framework->Input()->IsMouseCursorVisible());
}

bool EC_GraphicsViewCanvas::IsMouseOnTopOfCanvas(QPoint & mousePos, float2 & uv)
{
    OgreWorldPtr world = ParentScene()->GetWorld<OgreWorld>();
    EC_Camera *mainCamera = (world ? world->Renderer()->MainCameraComponent() : 0);
    if (!mainCamera)
        return false;

    if (mousePos.isNull())
        mousePos = GetFramework()->Input()->MousePos();

    // Test if mouse is on top of the 3D canvas
    Ray mouseRay = mainCamera->ScreenPointToRay(mousePos.x(), mousePos.y());
    RaycastResult *result = 0;
    EC_Mesh *mesh = ParentEntity() ? ParentEntity()->GetComponent<EC_Mesh>().get() : 0;
    if (mesh && mouseRay.Intersects(mesh->WorldOBB(), 0, 0))
    {
        result = world->Renderer()->Raycast(mousePos.x(), mousePos.y());
        uv.x = result->u;
        uv.y = result->v;
    }

    return (result && result->entity == ParentEntity() &&
    (Ogre::uint)result->submesh == submesh.Get() && GetFramework()->Input()->IsMouseCursorVisible());
}

QPointF EC_GraphicsViewCanvas::GetPointOnView(QPoint & mousePos)
{
    if (!graphicsView || !graphicsScene || IsMouseOnTopOfMainUI())
        return QPointF();

    float2 uv;
    if (!IsMouseOnTopOfCanvas(mousePos, uv))
        return QPointF();

    return graphicsView->mapToScene(graphicsView->width()*uv.x, graphicsView->height()*uv.y);
}

void EC_GraphicsViewCanvas::OnMouseEventReceived(MouseEvent *mouseEvent)
{
    QPoint mousePos(mouseEvent->x, mouseEvent->y);
    QPointF ptOnScene = GetPointOnView(mousePos);

    if (ptOnScene.isNull())
    {
        inputContext->ClearMouseCursorOverride();
        graphicsScene->clearFocus();
        if (isActivated)
        {
            isActivated = false;
            QEvent windowDeactivate(QEvent::WindowDeactivate);
            QApplication::sendEvent(graphicsScene, &windowDeactivate);
        }
        return;
    }

    if (!isActivated)
    {
        QEvent windowActivate(QEvent::WindowActivate);
        QApplication::sendEvent(graphicsScene, &windowActivate);
        isActivated = true;
    }

    switch(mouseEvent->eventType)
    {
    case MouseEvent::MouseMove:
        SendMouseEvent(QEvent::GraphicsSceneMouseMove, ptOnScene, mouseEvent);
        break;
    case MouseEvent::MouseScroll:
        SendMouseScrollEvent(mouseEvent, ptOnScene);
        break;
    case MouseEvent::MousePressed:
        SendMouseEvent(QEvent::GraphicsSceneMousePress, ptOnScene, mouseEvent);
        break;
    case MouseEvent::MouseReleased:
        SendMouseEvent(QEvent::GraphicsSceneMouseRelease, ptOnScene, mouseEvent);
        break;
    default:
        break;
    }

    QGraphicsItem *itemUnderMouse = graphicsScene->itemAt(ptOnScene);
    if (itemUnderMouse)
        inputContext->SetMouseCursorOverride(itemUnderMouse->cursor());
}

void EC_GraphicsViewCanvas::OnKeyEventReceived(KeyEvent *keyEvent)
{
    if (!graphicsScene->hasFocus())
        return;

    QPoint mousePos;
    float2 uv;
    if (!IsMouseOnTopOfCanvas(mousePos, uv))
        return;

    switch(keyEvent->eventType)
    {
    case KeyEvent::KeyPressed:
        SendKeyEvent(QEvent::KeyPress, keyEvent);
        break;
    case KeyEvent::KeyReleased:
        SendKeyEvent(QEvent::KeyRelease, keyEvent);
        break;
    default:
        break;
    }
}

void EC_GraphicsViewCanvas::OnDragEnterEvent(QDragEnterEvent *e)
{
    QPoint mousePos;
    QPointF ptOnView = GetPointOnView(mousePos);
    if (ptOnView.isNull())
        return;

    QGraphicsSceneDragDropEvent sceneEvent(QEvent::GraphicsSceneDragEnter);
    sceneEvent.setScenePos(ptOnView);
    sceneEvent.setScreenPos(ptOnView.toPoint());
    sceneEvent.setButtons(e->mouseButtons());
    sceneEvent.setModifiers(e->keyboardModifiers());
    sceneEvent.setPossibleActions(e->possibleActions());
    sceneEvent.setProposedAction(e->proposedAction());
    sceneEvent.setDropAction(e->dropAction());
    sceneEvent.setMimeData(e->mimeData());
    sceneEvent.setWidget(graphicsView);
    sceneEvent.setSource(e->source());

    QApplication::sendEvent(graphicsScene, &sceneEvent);

    e->setAccepted(sceneEvent.isAccepted());
    if (sceneEvent.isAccepted())
        e->setDropAction(sceneEvent.dropAction());
}

void EC_GraphicsViewCanvas::OnDragLeaveEvent(QDragLeaveEvent *e)
{
    QPoint mousePos;
    QPointF ptOnView = GetPointOnView(mousePos);
    if (ptOnView.isNull())
        return;

    ///\todo QGraphicsView uses a mechanism of 'lastDragDropEvent'. Evaluate whether it would be better to apply it here as well.
    QGraphicsSceneDragDropEvent sceneEvent(QEvent::GraphicsSceneDragLeave);
    sceneEvent.setScenePos(ptOnView);
    sceneEvent.setScreenPos(ptOnView.toPoint());
    sceneEvent.setWidget(graphicsView);

    QApplication::sendEvent(graphicsScene, &sceneEvent);

    e->setAccepted(sceneEvent.isAccepted());
}

void EC_GraphicsViewCanvas::OnDragMoveEvent(QDragMoveEvent *e)
{
    QPoint mousePos;
    QPointF ptOnView = GetPointOnView(mousePos);
    if (ptOnView.isNull())
        return;

    QGraphicsSceneDragDropEvent sceneEvent(QEvent::GraphicsSceneDragMove);
    sceneEvent.setScenePos(ptOnView);
    sceneEvent.setScreenPos(ptOnView.toPoint());
    sceneEvent.setButtons(e->mouseButtons());
    sceneEvent.setModifiers(e->keyboardModifiers());
    sceneEvent.setPossibleActions(e->possibleActions());
    sceneEvent.setProposedAction(e->proposedAction());
    sceneEvent.setDropAction(e->dropAction());
    sceneEvent.setMimeData(e->mimeData());
    sceneEvent.setWidget(graphicsView);
    sceneEvent.setSource(e->source());

    QApplication::sendEvent(graphicsScene, &sceneEvent);

    e->setAccepted(sceneEvent.isAccepted());
    if (sceneEvent.isAccepted())
        e->setDropAction(sceneEvent.dropAction());
}

void EC_GraphicsViewCanvas::OnDropEvent(QDropEvent *e)
{
    QPoint mousePos;
    QPointF ptOnView = GetPointOnView(mousePos);
    if (ptOnView.isNull())
        return;

    QGraphicsSceneDragDropEvent sceneEvent(QEvent::GraphicsSceneDrop);
    sceneEvent.setScenePos(ptOnView);
    sceneEvent.setScreenPos(ptOnView.toPoint());
    sceneEvent.setButtons(e->mouseButtons());
    sceneEvent.setModifiers(e->keyboardModifiers());
    sceneEvent.setPossibleActions(e->possibleActions());
    sceneEvent.setProposedAction(e->proposedAction());
    sceneEvent.setDropAction(e->dropAction());
    sceneEvent.setMimeData(e->mimeData());
    sceneEvent.setWidget(graphicsView);
    sceneEvent.setSource(e->source());

    QApplication::sendEvent(graphicsScene, &sceneEvent);

    e->setAccepted(sceneEvent.isAccepted());
    if (sceneEvent.isAccepted())
        e->setDropAction(sceneEvent.dropAction());
}

Ogre::MaterialPtr EC_GraphicsViewCanvas::OgreMaterial()
{
    EC_Mesh *mesh = ParentEntity() ? ParentEntity()->GetComponent<EC_Mesh>().get() : 0;
    if (!mesh)
        return Ogre::MaterialPtr();

    uint meshIndex = submesh.Get();
    if (meshIndex >= mesh->GetNumMaterials())
        return Ogre::MaterialPtr();

    /** Workaround non-existing assets for the "default" internal materials (LitTextured, AssetLoadError etc.).
        Otherwise, UpdateTexture() will render directly on those and the graphics view will be shown on
        everything else that uses those materials. */
    QString matName(mesh->GetMaterialName(submesh.Get()).c_str());
    if (!matName.contains(cMaterialBaseName))
    {
        if (!defaultMaterialAssets[matName.toStdString()])
            defaultMaterialAssets[matName.toStdString()] = dynamic_pointer_cast<OgreMaterialAsset>(framework->Asset()->GetAsset(QString("Ogre Media:%1.material").arg(matName)));

        OnMaterialChanged(submesh.Get(), "");
    }

    return Ogre::MaterialManager::getSingleton().getByName(mesh->GetMaterialName(meshIndex));
}

void EC_GraphicsViewCanvas::SendMouseEvent(QEvent::Type type, const QPointF &point, MouseEvent *e)
{
    Qt::MouseButton button = (type == QEvent::GraphicsSceneMouseMove ? Qt::NoButton : (Qt::MouseButton)e->button);
    QGraphicsSceneMouseEvent mouseEvent(type);
    mouseEvent.setButtonDownScenePos(button, point);
    mouseEvent.setButtonDownScreenPos(button, point.toPoint());

    mouseEvent.setScenePos(point);
    mouseEvent.setScreenPos(point.toPoint());
    mouseEvent.setLastScenePos(point);
    mouseEvent.setLastScreenPos(point.toPoint());
    mouseEvent.setButton(button);
    mouseEvent.setButtons((Qt::MouseButtons)e->otherButtons);

    mouseEvent.setModifiers((Qt::KeyboardModifiers)e->modifiers);
    mouseEvent.setAccepted(false);

    QApplication::sendEvent(graphicsView->scene(), &mouseEvent);
}

void EC_GraphicsViewCanvas::SendMouseScrollEvent(MouseEvent *e, const QPointF &ptOnScene)
{
    QGraphicsSceneWheelEvent mouseEvent(QEvent::GraphicsSceneWheel);
    mouseEvent.setScenePos(ptOnScene);
    mouseEvent.setScreenPos(ptOnScene.toPoint());
    mouseEvent.setButtons((Qt::MouseButtons)e->button);
    mouseEvent.setDelta(e->relativeZ);
    mouseEvent.setModifiers((Qt::KeyboardModifiers)e->modifiers);
    mouseEvent.setOrientation(Qt::Vertical);
    mouseEvent.setAccepted(false);

    QApplication::sendEvent(graphicsView->scene(), &mouseEvent);
}

void EC_GraphicsViewCanvas::SendKeyEvent(QEvent::Type type, KeyEvent *e)
{
    QKeyEvent keyEvent(type, e->keyCode, (Qt::KeyboardModifiers)e->modifiers, e->text, e->keyPressCount > 1, e->keyPressCount);
    QApplication::sendEvent(graphicsView->scene(), &keyEvent);
    if (keyEvent.isAccepted())
        e->Suppress();
}

void EC_GraphicsViewCanvas::OnMaterialChanged(uint materialIndex, const QString &materialName)
{
    EC_Mesh *mesh = ParentEntity() ? ParentEntity()->GetComponent<EC_Mesh>().get() : 0;
    if (mesh && materialIndex == submesh.Get())
    {
        OgreMaterialAssetPtr material = mesh->MaterialAsset(materialIndex);
        if (!material) // Try default material assets
            material = defaultMaterialAssets[mesh->GetMaterialName(materialIndex)];
        if (material && !material->IsLoaded())
            material->LoadFromCache();

        QString newMaterialName = framework->Asset()->GenerateUniqueAssetName("OgreMaterial", cMaterialBaseName);
        OgreMaterialAssetPtr newMaterial = material ? dynamic_pointer_cast<OgreMaterialAsset>(material->Clone(newMaterialName)) : OgreMaterialAssetPtr();
        if (newMaterial)
        {
            newMaterial->SetTexture(0, 0, 0, outputTexture.Get());

            // Prevent infinite loop
            disconnect(mesh, SIGNAL(MaterialChanged(uint, const QString &)), this, SLOT(OnMaterialChanged(uint, const QString &)));
            mesh->SetMaterial(materialIndex, newMaterial->Name()); ///\todo Should we reset internal materials upon submesh attribute change?
            connect(mesh, SIGNAL(MaterialChanged(uint, const QString &)), this, SLOT(OnMaterialChanged(uint, const QString &)), Qt::UniqueConnection);

            UpdateTexture();

            // Work around the QGraphicsView/QGraphicsScene bug that leaves 1 pixel padding around the scene and the view.
            Ogre::TextureUnitState *tu = newMaterial->ogreMaterial->getTechnique(0)->getPass(0)->getTextureUnitState(0);
            float4x4 m = float4x4::identity;
            float w = (float)width.Get();
            float h = (float)height.Get();
            m[0][0] = (w-8.f)/w; /**< @todo 2 pixels should be enough in theory, but doesn't seem to suffice. Going with 8 for now. */
            m[1][1] = (h-8.f)/h;
            m[0][3] = 4.f/w;
            m[1][3] = 4.f/h;
            tu->setTextureTransform(m);
        }
    }
}

void EC_GraphicsViewCanvas::UpdateTexture()
{
    PROFILE(EC_GraphicsViewCanvas_UpdateTexture);

    if (!paintTarget || (paintTarget->target.width() == 0 || paintTarget->target.height() == 0))
        return;

    TextureAsset *textureAsset = dynamic_cast<TextureAsset*>(framework->Asset()->GetAsset(outputTexture.Get()).get());
    if (!textureAsset)
    {
        // Create a new programmatic texture asset if one didn't exist.
        OgreRenderer::RendererPtr renderer = GetFramework()->GetModule<OgreRenderer::OgreRenderingModule>()->GetRenderer();
        textureAsset = dynamic_cast<TextureAsset*>(framework->Asset()->CreateNewAsset("Texture", renderer->GetUniqueObjectName("Tex_NoMipMaps").c_str()).get());
        if (!textureAsset)
        {
            LogWarning("EC_GraphicsViewCanvas::UpdateTexture: Could not create a texture asset to store the GraphicsViewCanvas contents!");
            return;
        }
    }

    // Allocate GPU memory for the texture if one didn't exist. Also make sure the texture is without mipmaps.
    if (textureAsset->ogreTexture.isNull() || !QString(textureAsset->ogreTexture->getName().c_str()).contains("Tex_NoMipMaps"))
    {
        // Re-create texture without mipmaps.
        OgreRenderer::RendererPtr renderer = GetFramework()->GetModule<OgreRenderer::OgreRenderingModule>()->GetRenderer();
        QString textureName = renderer->GetUniqueObjectName("Tex_NoMipMaps").c_str();
        Ogre::TexturePtr texture = Ogre::TextureManager::getSingleton().createManual(
            textureName.toStdString(), Ogre::ResourceGroupManager::DEFAULT_RESOURCE_GROUP_NAME,
            Ogre::TEX_TYPE_2D, paintTarget->target.width(), paintTarget->target.height(), 0, Ogre::PF_A8R8G8B8, Ogre::TU_STATIC_WRITE_ONLY);
        if (texture.isNull())
            return;
        textureAsset->ogreTexture = texture;
    }

    // Apply the texture onto the material. The material may change at runtime, so re-apply to retain the binding at all times.
    Ogre::MaterialPtr material = OgreMaterial();
    if (material.get() && !textureAsset->ogreTexture.isNull())
    {
        if (material->getTechnique(0)->getPass(0)->getNumTextureUnitStates() == 0) // No texture unit states - create one
            material->getTechnique(0)->getPass(0)->createTextureUnitState();
        material->getTechnique(0)->getPass(0)->getTextureUnitState(0)->setTextureName(textureAsset->ogreTexture->getName());
    }

    textureAsset->SetContents(paintTarget->target.width(), paintTarget->target.height(), (const u8*)paintTarget->target.bits(),
        paintTarget->target.width() * paintTarget->target.height() * 4, Ogre::PF_A8R8G8B8, false, true, false);
}
