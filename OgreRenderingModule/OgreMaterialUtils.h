#ifndef incl_OgreMaterialUtils_h
#define incl_OgreMaterialUtils_h

#include <Ogre.h>

#include "OgreModuleApi.h"
#include "ResourceInterface.h"

namespace OgreRenderer
{
    //! Standard legacy variation (lit)
    const Core::uint LEGACYMAT_NORMAL = 0;
    
    //! Fullbright legacy variation (can be combined with others)
    const Core::uint LEGACYMAT_FULLBRIGHT = 1;
    
    //! Additive blended legacy variation
    const Core::uint LEGACYMAT_ADDITIVE = 2;
    
    //! Forced alpha legacy variation
    const Core::uint LEGACYMAT_ALPHA = 4;

    //! Vertex color variation
    const Core::uint LEGACYMAT_VERTEXCOL = 6;
    
    //! Vertex color + forced alpha variation
    const Core::uint LEGACYMAT_VERTEXCOLALPHA = 8;
    
    //! Maximum legacy material variations
    const Core::uint MAX_MATERIAL_VARIATIONS = 10;

    //! Gets material suffix by variation type
    std::string OGRE_MODULE_API GetMaterialSuffix(Core::uint variation);
    
    //! Returns if material suffix valid
    bool OGRE_MODULE_API IsMaterialSuffixValid(const std::string& suffix);
    
    /// Returns an Ogre material with the given name, or creates it if it doesn't exist. The material
    /// is derived from an UnlitTextured material, that's a simple one to use for debugging visualizations.
    Ogre::MaterialPtr OGRE_MODULE_API GetOrCreateUnlitTexturedMaterial(const char *materialName);

    /// Returns an Ogre material with the given name, or creates it if it doesn't exist. The material
    /// is derived from an LitTextured material, that's a simple one to use for basic diffuse texture visualizations.
    Ogre::MaterialPtr OGRE_MODULE_API GetOrCreateLitTexturedMaterial(const char *materialName);

    //! Creates legacy material variations from texture
    /*! @param texture_name texture to use
        @param update if true, will recreate the materials even if they already exist (used when updating the texture, and
        texture alpha settings possibly change)
     */
    void OGRE_MODULE_API CreateLegacyMaterials(const std::string& texture_name, bool update = false);

    //! Sets texture unit on a material to a given texture name.
    /*! If texture cannot actually be found, uses the missing texture texture
     */ 
    void OGRE_MODULE_API SetTextureUnitOnMaterial(Ogre::MaterialPtr material, const std::string& texture_name, Core::uint index = 0);
    
    //! Replaces texture name in all passes, techniques, textureunits with another name
    /*! If replacement texture cannot actually be found, uses the missing texture texture
     */ 
    void OGRE_MODULE_API ReplaceTextureOnMaterial(Ogre::MaterialPtr material, const std::string& original_name, const std::string& texture_name);
    
    //! Creates a material resource from an Ogre material pointer
    Foundation::ResourcePtr OGRE_MODULE_API CreateResourceFromMaterial(Ogre::MaterialPtr material);
}

#endif
