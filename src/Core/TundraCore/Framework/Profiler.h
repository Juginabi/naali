// For conditions of distribution and use, see copyright notice in LICENSE

#pragma once

#include "CoreDefines.h"
#include "Win.h"
#include "TundraCoreApi.h"
#include "Framework.h"
#include "HighPerfClock.h"

// Allows short-timed block tracing
#define TRACESTART(x) kNet::PolledTimer polledTimer_##x;
#define TRACEEND(x) std::cout << #x << " finished in " << polledTimer_##x.MSecsElapsed() << " msecs." << std::endl;

#if defined(PROFILING)

/// Profiles a block of code in current scope. Ends the profiling when it goes out of scope
/** Name of the profiling block must be unique in the scope, so do not use the name of the function
    as the name of the profiling block!

    @param x Unique name for the profiling block, use without quotes, f.ex. PROFILE(name_of_the_block) */
#define PROFILE(x) ProfilerSection x ## __profiler__(#x);

/// Optionally ends the current profiling block
/** Use when you wish to end a profiling block before it goes out of scope. */
#define ELIFORP(x) x ## __profiler__.Destruct();

/// Resets profiling data per frame and prepares the next frame.
/// \todo Currently this is not called at any point in the code, as DebugStatsModule implements its own profiler frame counting via the custom 
/// fields in the profiler nodes.
#define RESETPROFILER { ProfilerSection::GetProfiler()->ResetValues(); }

#define STARTTIMEDBLOCK(name) tick_t timedBlock##name = GetCurrentClockTime();
#define LOGTIMEDBLOCK(name) { float elapsed = (float)(GetCurrentClockTime() - timedBlock##name) / GetCurrentClockFreq(); printf("%s: Took %f seconds.\n", #name, elapsed); }
#else
#define STARTTIMEDBLOCK(name)
#define LOGTIMEDBLOCK(name)
#define PROFILE(x)
#define ELIFORP(x)
#define RESETPROFILER
#endif

class ProfilerNodeTree;

/// Profiles a block of code
class TUNDRACORE_API ProfilerBlock
{
public:
    /// default destructor
    ~ProfilerBlock() {}

    /// Call before using any performance counters
    /** Returns true if Performance Counter is supported on the current h/w, false otherwise. */
    static bool QueryCapability();

    void Start()
    {
        start_time_ = GetCurrentClockTime();
    }

    void Stop()
    {
        end_time_ = GetCurrentClockTime();
    }

    /// Returns elapsed time between start and stop in seconds
    double ElapsedTimeSeconds()
    {
        time_elapsed_ = end_time_ - start_time_;
        double elapsed_s = (double)time_elapsed_ / (double)GetCurrentClockFreq();
        return (elapsed_s < 0 ? 0 : elapsed_s);
    }

    static double ElapsedTimeSeconds(const s64 &start, const s64 &end)
    {
        double elapsed_s = (double)(end - start) / (double)GetCurrentClockFreq();
        return (elapsed_s < 0 ? 0 : elapsed_s);
    }

    /// Returns elapsed time in microseconds
    s64 ElapsedTimeMicroSeconds()
    {
        time_elapsed_ = end_time_ - start_time_;
        s64 elapsed_us = static_cast<s64>(time_elapsed_ * 1000000) / GetCurrentClockFreq();
        return (elapsed_us < 0 ? 0 : (s64)0);
    }

private:
    friend class ProfilerNode;
    /// default constructor
    ProfilerBlock() {}

    s64 start_time_;
    s64 end_time_;

    s64 time_elapsed_;
};

class Profiler;

/// N-ary tree structure for profiling nodes
class TUNDRACORE_API ProfilerNodeTree
{
public:
    typedef std::list<shared_ptr<ProfilerNodeTree> > NodeList;

    /// constructor that takes a name for the node
    explicit ProfilerNodeTree(const std::string &name) : name_(name), parent_(0), recursion_(0) {}

    /// destructor
    virtual ~ProfilerNodeTree()
    {
    }
    
    /// Resets this node and all child nodes
    virtual void ResetValues()
    {
        for(NodeList::iterator it = children_.begin() ; it != children_.end() ; ++it)
            (*it)->ResetValues();
    }

    /// Add a child for this node
    void AddChild(shared_ptr<ProfilerNodeTree> node)
    {
        children_.push_back(node);
        node->parent_ = this;
    }

    /// Removes the child node.
    void RemoveChild(ProfilerNodeTree *node)
    {
        if (node)
            for(NodeList::iterator iter = children_.begin(); iter != children_.end(); ++iter)
                if ((*iter).get() == node)
                {
                    children_.erase(iter);
                    return;
                }
    }

    /// Returns a child node
    /** @param name Name of the child node
        @return Child node or 0 if the node was not child */
    ProfilerNodeTree* GetChild(const std::string &name)
    {
        assert (name != name_);
        for(NodeList::iterator it = children_.begin() ; it != children_.end() ; ++it)
            if ((*it)->name_ == name)
                return (*it).get();
        return 0;
    }

    /// Returns the name of this node
    const std::string &Name() const { return name_; }

    /// Returns the parent of this node
    ProfilerNodeTree *Parent() { return parent_; }

    /// Returns list of children for introspection
    const NodeList &GetChildren() const { return children_; }
    NodeList &GetChildren(){ return children_; }

private:
    friend class Profiler;
    
    /// list of all children for this node
    NodeList children_;
    /// cached parent node for easy access
    ProfilerNodeTree *parent_;
    /// Name of this node
    const std::string name_;

    /// helper counter for recursion
    int recursion_;
};
typedef shared_ptr<ProfilerNodeTree> ProfilerNodeTreePtr;

/// Data container for profiling data for a profiling block
class TUNDRACORE_API ProfilerNode : public ProfilerNodeTree
{
public:
    /// constructor that takes a name for the node
    explicit ProfilerNode(const std::string &name) : 
    ProfilerNodeTree(name),
        num_called_total_(0),
        num_called_(0),
        num_called_current_(0),
        total_(0.0),
        elapsed_current_(0.0),
        elapsed_(0.0) ,
        elapsed_min_(0.0),
        elapsed_max_(0.0),
        elapsed_min_current_(0.0),
        elapsed_max_current_(0.0),
        num_called_custom_(0),
        total_custom_(0),
        custom_elapsed_min_(0),
        custom_elapsed_max_(0)
        {
        }

    virtual ~ProfilerNode()
    {
    }

    void ResetValues()
    {
        num_called_ = num_called_current_;
        num_called_current_ = 0;

        elapsed_ = elapsed_current_;
        elapsed_current_ = 0;

        elapsed_min_ = elapsed_min_current_;
        elapsed_min_current_ = 0;

        elapsed_max_ = elapsed_max_current_;
        elapsed_max_current_ = 0;

        ProfilerNodeTree::ResetValues();
    }

    /// Number of times this profile has been called during the execution of the program
    unsigned long num_called_total_;

    /// Number of times this profile was called during last frame
    unsigned long num_called_;

    /// Total time spend in this profile during the execution of the program
    double total_;

    /// Time spend in this profiling block during last frame.
    double elapsed_;

    /// Minimum time spend in this profile during last frame
    double elapsed_min_;

    /// Maximum time spend in this profile during last frame
    double elapsed_max_;

    // Profiling data is also accumulated here, and can be reset on a custom interval.
    // Mutable since the application can alter these at will, but the above "official"
    // values may not be touched.
    mutable unsigned long num_called_custom_;
    mutable double total_custom_;
    mutable double custom_elapsed_min_;
    mutable double custom_elapsed_max_;

    float TotalCustomSpentInChildren() const;

private:
    friend class Profiler;

    unsigned long num_called_current_;
    double elapsed_current_;
    double elapsed_min_current_;
    double elapsed_max_current_;

    ProfilerBlock block_;
};

/// Provides profiling access for scripts.
class TUNDRACORE_API ProfilerQObj : public QObject
{
    Q_OBJECT

public slots:
    /// Begins profiling block.
    /** @param name Name of the block.
        @see EndBlock() */
    void BeginBlock(const QString &name);

    /// Ends profiling block.
    /** @see BeginBlock() */
    void EndBlock();
};

/// Profiler can be used to measure execution time of a block of code.
/** Do not use this class directly for profiling, use instead PROFILE
    and ELIFORP macros.

    Threadsafety: Can *only* be used from the main thread.

 */
class TUNDRACORE_API Profiler
{
public:
    Profiler();

    ~Profiler();
    
    /// Start a profiling block.
    /** Normally you don't use this directly, instead you use the macro PROFILE.
        However if you want profiling that lasts out of scope, you can use this directly,
        you also need to call matching Profiler::EndBlock()

        Can be called multiple times with the same name without calling EndBlock() for
        recursion support.

        Re-entrant. */
    void StartBlock(const std::string &name);

    /// End the profiling block
    /** Each StartBlock() should have a matching EndBlock(). Recursion is supported.
        Re-entrant. */
    void EndBlock(const std::string &name);

    /// Reset profiling data for the current frame. Don't call directly, use RESETPROFILER macro instead.
    void ResetValues();


    /// Returns root profiling node. \todo Deprecated, the actual locking is a no-op
    ProfilerNodeTree *Lock()
    {
        return &root_;
    }

	/// \todo Deprecated, no-op
    void Release()
    {
    }

    ProfilerNodeTree *GetRoot() { return &root_; }

    ProfilerNodeTree *FindBlockByName(ProfilerNodeTree *parent, const char *name);
    ProfilerNodeTree *FindBlockByName(const char *name);
    
    /// Returns the currently topmost active node on the profiler tree.
    /// Only used internally, *NOT* for public use.
    ProfilerNodeTree *CurrentNode() { return current_node_; }
private:
    /// The single global root node object.
    ProfilerNodeTree root_;

    /// Points to the current topmost profile block in the stack.
    ProfilerNodeTree *current_node_;

    friend class ProfilerQObj;
};

/// Used by PROFILE - macro to automatically stop profiling clock when going out of scope
class TUNDRACORE_API ProfilerSection
{
public:
    explicit ProfilerSection(const std::string &name) : name_(name), destroyed_(false)
    {
        assert(Framework::Instance() && "Cannot get Framework instance! Did you forget to call Framework::SetInstance(fw); in your TundraPluginMain?");
        GetProfiler()->StartBlock(name);
    }

    ~ProfilerSection()
    {
        if (!destroyed_)
        {
            Destruct();
        }
    }

    /// Explicitly destroy this section before it runs out of scope
    __inline void Destruct()
    {
        assert (Framework::Instance() && "Trying to profile before profiler initialized.");

        GetProfiler()->EndBlock(name_);
        destroyed_ = true;
    }
    static Profiler *GetProfiler()
    {
        assert(Framework::Instance());
#ifdef PROFILING
        return Framework::Instance()->GetProfiler();
#else
        return 0;
#endif
    }

private:
    /// Name of this profiling section
    const std::string name_;

    /// True if this section has explicitly been destroyed before it run out of scope
    bool destroyed_;
};
