() => {
  // Updated main filter function
  function filterMembers(userIds, slackBotToken) {
    return filterOutIgnore(filterOutBots(userIds, slackBotToken));
  }

  // Updated filter functions that use cached user info
  function filterOutBots(userIds, slackBotToken) {
    return userIds.filter((userId) => {
      const userInfo = getUserInfo(userId, slackBotToken);
      return userInfo && !userInfo.is_bot;
    });
  }

  function filterOutIgnore(userIds) {
    const userProperties = PropertiesService.getUserProperties();
    const IGNORE_LIST =
      userProperties.getProperty("SLACK_IGNORE_USERS_0001").split(", ") || [];

    return userIds.filter((userId) => {
      if (IGNORE_LIST.includes(userId)) {
        return false;
      }
      return true;
    });
  }

  // User info cache with 15-minute expiration
  const USER_CACHE_KEY = "slack_user_cache";
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

  function getUserInfo(userId, slackBotToken) {
    if (!userId) {
      return {
        ok: false,
        message: "User Id missing",
      };
    }

    // Check cache first
    const cachedUser = getCachedUserInfo(userId);
    if (cachedUser) {
      console.log(`Using cached data for user: ${userId}`);
      return cachedUser;
    }

    // Fetch from API if not in cache
    console.log(`Fetching fresh data for user: ${userId}`);
    const url = "https://slack.com/api/users.info";
    const options = {
      method: "get",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(`${url}?user=${userId}`, options);
    const result = JSON.parse(response.getContentText());

    if (result.ok && result.user) {
      // Cache the user info
      cacheUserInfo(userId, result.user);
      return result.user;
    }

    console.log(`Failed to fetch user info for ${userId}: ${result.error}`);
    return null;
  }

  function getCachedUserInfo(userId) {
    try {
      const cache = PropertiesService.getScriptProperties();
      const cacheData = cache.getProperty(USER_CACHE_KEY);

      if (!cacheData) {
        return null;
      }

      const userCache = JSON.parse(cacheData);
      const userEntry = userCache[userId];

      if (!userEntry) {
        return null;
      }

      // Check if cache entry is expired
      const now = new Date().getTime();
      if (now - userEntry.timestamp > CACHE_DURATION) {
        console.log(`Cache expired for user: ${userId}`);
        // Remove expired entry
        delete userCache[userId];
        cache.setProperty(USER_CACHE_KEY, JSON.stringify(userCache));
        return null;
      }

      return userEntry.data;
    } catch (error) {
      console.log(`Error reading cache: ${error}`);
      return null;
    }
  }

  function cacheUserInfo(userId, userData) {
    try {
      const cache = PropertiesService.getScriptProperties();
      let userCache = {};

      // Get existing cache
      const existingCache = cache.getProperty(USER_CACHE_KEY);
      if (existingCache) {
        userCache = JSON.parse(existingCache);
      }

      // Add/update user entry
      userCache[userId] = {
        data: userData,
        timestamp: new Date().getTime(),
      };

      // Clean up expired entries while we're here
      cleanExpiredCache(userCache);

      // Save back to cache
      cache.setProperty(USER_CACHE_KEY, JSON.stringify(userCache));
      console.log(`Cached user info for: ${userId}`);
    } catch (error) {
      console.log(`Error caching user info: ${error}`);
    }
  }

  function cleanExpiredCache(userCache) {
    const now = new Date().getTime();
    let cleanedCount = 0;

    for (const userId in userCache) {
      if (now - userCache[userId].timestamp > CACHE_DURATION) {
        delete userCache[userId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  // Utility function to clear cache manually if needed
  function clearUserCache() {
    try {
      const cache = PropertiesService.getScriptProperties();
      cache.deleteProperty(USER_CACHE_KEY);
      console.log("User cache cleared");
    } catch (error) {
      console.log(`Error clearing cache: ${error}`);
    }
  }

  // Utility function to check cache status
  function getCacheStatus() {
    try {
      const cache = PropertiesService.getScriptProperties();
      const cacheData = cache.getProperty(USER_CACHE_KEY);

      if (!cacheData) {
        return { totalUsers: 0, message: "Cache is empty" };
      }

      const userCache = JSON.parse(cacheData);
      const now = new Date().getTime();
      let activeCount = 0;
      let expiredCount = 0;

      for (const userId in userCache) {
        if (now - userCache[userId].timestamp > CACHE_DURATION) {
          expiredCount++;
        } else {
          activeCount++;
        }
      }

      return {
        totalUsers: activeCount + expiredCount,
        activeUsers: activeCount,
        expiredUsers: expiredCount,
        message: `Cache contains ${activeCount} active and ${expiredCount} expired entries`,
      };
    } catch (error) {
      return { error: `Error reading cache: ${error}` };
    }
  }

  function filterNotReactionUsers(mentionedUsers = [], reactionUsers = []) {
    if (!mentionedUsers || mentionedUsers.length === 0) {
      return {
        ok: false,
        message: "Mentioned User does not exist or empty",
      };
    }

    var notReactionUser = [];
    mentionedUsers.forEach((userId) => {
      if (!reactionUsers.includes(userId)) {
        notReactionUser.push(userId);
      }
    });

    return {
      ok: true,
      message: "Successfully filtered users",
      value: notReactionUser,
    };
  }
};
