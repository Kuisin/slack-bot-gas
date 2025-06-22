function slackManagerBot(scriptProperties, userProperties = null, options = {}) {
  if (!scriptProperties) {
    return {
      ok: false,
      message: "Script properties is required",
    }
  }
  if (!userProperties || typeof userProperties !== "object") {
    console.log("User properties not valid, using script properties instead");
    userProperties = scriptProperties;
  }

  const SLACK_BOT_TOKEN = scriptProperties.getProperty("SLACK_BOT_TOKEN_0001") || null;
  const SLACK_USER_TOKEN = scriptProperties.getProperty("SLACK_USER_TOKEN_0001") || null;
  const SLACK_VERIFICATION_TOKEN = scriptProperties.getProperty(
    "SLACK_VERIFICATION_TOKEN_0001"
  ) || null;
  const ignoreUsers = scriptProperties.getProperty("SLACK_IGNORE_USERS_0001") || "";

  var SLACK_IGNORE_USERS = [];
  if (ignoreUsers && typeof ignoreUsers === "string") {
    const ignoreUsersArr = ignoreUsers.split(",") || [];
    SLACK_IGNORE_USERS = ignoreUsersArr.map((userId) => userId.trim());
  }

  var TOKEN_PATTERNS = {
    BOT: /^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    USER: /^xoxp-[0-9]+-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    APP: /^xapp-[0-9]+-[A-Z0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    WEBHOOK:
      /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/,
  };

  // Constants for reactions
  const TRIGGER_REACTION_READ = options.triggerReactionRead || "check_eyes";
  const TRIGGER_REACTION_ANY = options.triggerReactionAny || "check_any";
  const REACTION_READ = options.reactionRead || "eyes";

  // User info cache with 15-minute expiration
  const USER_CACHE_KEY = "slack_user_cache";
  var CACHE_MINUTES = 15;
  if (options.cacheMinutes && typeof options.cacheMinutes === "number" && options.cacheMinutes > 0) {
    CACHE_MINUTES = options.cacheMinutes || 15;
  }
  const CACHE_DURATION = CACHE_MINUTES * 60 * 1000;
  console.log(`Cache duration: ${CACHE_DURATION} milliseconds`);

  // FILTER FUNCTIONS
  function filterMembers(userIds, slackBotToken) {
    return filterOutIgnore(filterOutBots(userIds, slackBotToken));
  }

  function filterOutBots(userIds, slackBotToken) {
    return userIds.filter((userId) => {
      const userInfo = getUserInfo(userId, slackBotToken);
      return userInfo && !userInfo.is_bot;
    });
  }

  function filterOutIgnore(userIds) {
    const ignoreUsersString = scriptProperties.getProperty("SLACK_IGNORE_USERS_0001");
    const IGNORE_LIST = ignoreUsersString ? ignoreUsersString.split(",").map(id => id.trim()) : [];

    return userIds.filter((userId) => {
      if (IGNORE_LIST.includes(userId)) {
        return false;
      }
      return true;
    });
  }

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
      const cacheData = scriptProperties.getProperty(USER_CACHE_KEY);

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
        scriptProperties.setProperty(USER_CACHE_KEY, JSON.stringify(userCache));
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
      let userCache = {};

      // Get existing cache
      const existingCache = scriptProperties.getProperty(USER_CACHE_KEY);
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
      scriptProperties.setProperty(USER_CACHE_KEY, JSON.stringify(userCache));
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

  // GENERAL FUNCTIONS
  function postToThread(
    channelId,
    messageTs,
    icon = "bell",
    text,
    slackBotToken
  ) {
    if (!channelId || !text || !messageTs) {
      return {
        ok: false,
        message: "Missing channel Id or Text",
      };
    }

    var url = "https://slack.com/api/chat.postMessage";
    var payload = {
      channel: channelId,
      text: text,
      thread_ts: messageTs,
      username: "Reaction Reminder",
      icon_emoji: `:${icon}:`,
    };
    var options = {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      return {
        ok: true,
        message: "Successfully send message to thread",
      };
    } else {
      return {
        ok: false,
        message: "Error: " + result.error,
      };
    }
  }

  function getMessageDetails(channelId, messageTs, slackBotToken) {
    if (!channelId || !messageTs) {
      return {
        ok: false,
        message: "Channel Id or MessageTs missing.",
      };
    }

    var threadUrl = "https://slack.com/api/conversations.replies";
    var threadPayload = {
      channel: channelId,
      ts: messageTs,
    };
    var options = {
      method: "get",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };

    var threadResponse = UrlFetchApp.fetch(
      threadUrl +
        "?" +
        Object.keys(threadPayload)
          .map(function (key) {
            return key + "=" + threadPayload[key];
          })
          .join("&"),
      options
    );

    var threadResult = JSON.parse(threadResponse.getContentText());

    if (
      threadResult.ok &&
      threadResult.messages &&
      threadResult.messages.length > 0
    ) {
      var targetMessage = threadResult.messages.find(function (msg) {
        return msg.ts === messageTs;
      });

      if (targetMessage) {
        return {
          ok: true,
          message: "Successfully get message text.",
          value: targetMessage,
        };
      } else {
        return {
          ok: false,
          message: "Failed to get message text.",
          value: targetMessage,
        };
      }
    }

    return {
      ok: false,
      message: "Response Error: " + threadResult.error,
    };
  }

  // REACTION FUNCTIONS
  function addReaction(channelId, messageTs, reactionId, slackBotToken) {
    var url = "https://slack.com/api/reactions.add";
    var payload = {
      channel: channelId,
      timestamp: messageTs,
      name: reactionId,
    };
    var options = {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      return {
        ok: true,
        message: "Successfully add reaction",
      };
    } else {
      console.log("input:", payload);
      console.log("Error:", result);
      return {
        ok: false,
        message: "Error: " + result.error,
      };
    }
  }

  function removeReaction(channelId, messageTs, reactionId, slackBotToken) {
    var url = "https://slack.com/api/reactions.remove";
    var payload = {
      channel: channelId,
      timestamp: messageTs,
      name: reactionId,
    };
    var options = {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      return {
        ok: true,
        message: "Successfully remove reaction",
      };
    } else {
      console.log("input:", payload);
      console.log("Error:", result);
      return {
        ok: false,
        message: "Error: " + result.error,
      };
    }
  }

  function orderReaction(reactionList = []) {
    var resultList = [];

    // add default read reaction on top
    const REACTION_READ = "eyes";
    if (reactionList.includes(REACTION_READ)) {
      resultList.push(REACTION_READ);
    }

    // order number reaction
    const numberReactions = [];
    const numberWords = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
    ];

    for (const numberWord of numberWords) {
      if (reactionList.includes(numberWord)) {
        numberReactions.push(numberWord);
      }
    }
    resultList.push(...numberReactions);

    // sort any other reactions
    const usedReactions = new Set([REACTION_READ, ...numberReactions]);
    const otherReactions = reactionList
      .filter((reaction) => !usedReactions.has(reaction))
      .sort();

    resultList.push(...otherReactions);

    return resultList;
  }

  function getMentionedUsers(channelId, messageTs, slackBotToken) {
    const messageDetails = getMessageDetails(
      channelId,
      messageTs,
      slackBotToken
    );
    if (!messageDetails.ok) {
      return {
        ok: false,
        message: `Error: ${messageDetails.message}`,
      };
    }

    var toUsers = [];
    var ccUsers = [];

    var hasCc = false;
    var originalText = messageDetails.value.text;
    var toText = messageDetails.value.text;
    var ccText = "";

    var ccIndex = originalText.search(/\bcc\b/i);
    if (ccIndex !== -1) {
      hasCc = true;
      toText = originalText.substring(0, ccIndex);
      ccText = originalText.substring(ccIndex + 2);
    }

    const channelMembersResult = getChannelUser(channelId, slackBotToken);
    if (!channelMembersResult.ok) {
      return {
        ok: false,
        message: "Error: " + channelMembersResult.message,
      };
    }

    const channelMembers = channelMembersResult.value;
    if (originalText.includes("<!channel>")) {
      if (toText.includes("<!channel>")) {
        toUsers.push.apply(toUsers, channelMembers);
      }
      if (ccText.includes("<!channel>")) {
        ccUsers.push.apply(ccUsers, channelMembers);
      }
    }

    // Process TO users
    var regexGroup = /<!subteam\^(\w+)>/g;
    var matchGroup;
    while ((matchGroup = regexGroup.exec(toText)) !== null) {
      var groupMembers = getUserGroupMembers(matchGroup[1], slackBotToken);
      if (groupMembers.ok) {
        toUsers.push.apply(toUsers, groupMembers.value);
      } else {
        console.log("Error: " + groupMembers.message);
      }
    }

    var regex = /<@(\w+)>/g;
    var match;
    while ((match = regex.exec(toText)) !== null) {
      toUsers.push(match[1]);
    }

    // Process CC users
    if (hasCc) {
      var regexGroup = /<!subteam\^(\w+)>/g;
      var matchGroup;
      while ((matchGroup = regexGroup.exec(ccText)) !== null) {
        var groupMembers = getUserGroupMembers(matchGroup[1], slackBotToken);
        if (groupMembers.ok) {
          ccUsers.push.apply(ccUsers, groupMembers.value);
        } else {
          console.log("Error: " + groupMembers.message);
        }
      }

      var regex = /<@(\w+)>/g;
      var match;
      while ((match = regex.exec(ccText)) !== null) {
        ccUsers.push(match[1]);
      }
    }

    var uniqueToUsers = filterMembers(
      Array.from(new Set(toUsers)),
      slackBotToken
    );

    var uniqueCcUsers = filterMembers(
      Array.from(new Set(ccUsers)),
      slackBotToken
    );
    uniqueCcUsers = uniqueCcUsers.filter(
      (userId) => !uniqueToUsers.includes(userId)
    );

    uniqueToUsers = uniqueToUsers.filter((userId) =>
      channelMembers.includes(userId)
    );
    uniqueCcUsers = uniqueCcUsers.filter((userId) =>
      channelMembers.includes(userId)
    );

    if (uniqueToUsers && uniqueCcUsers) {
      return {
        ok: true,
        message: "Successfully get mentioned users",
        value: {
          allUsers: [].concat(uniqueToUsers, uniqueCcUsers).sort(),
          toUsers: uniqueToUsers.sort() || [],
          ccUsers: uniqueCcUsers.sort() || [],
        },
      };
    } else {
      return {
        ok: false,
        message: "Failed to get mentioned users",
      };
    }
  }

  function getReactionUsers(channelId, messageTs, slackBotToken) {
    var url = "https://slack.com/api/reactions.get";
    var payload = {
      channel: channelId,
      timestamp: messageTs,
    };
    var options = {
      method: "get",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };
    var response = UrlFetchApp.fetch(
      url +
        "?" +
        Object.keys(payload)
          .map(function (key) {
            return key + "=" + payload[key];
          })
          .join("&"),
      options
    );

    const result = JSON.parse(response.getContentText());

    var reactionUsersObj = {};
    result.message.reactions.forEach((data) => {
      reactionUsersObj[data.name] = data.users;
    });

    return {
      ok: true,
      message: "Successfully get reaction users.",
      value: reactionUsersObj,
    };
  }

  // USER FUNCTIONS
  function getChannelUser(channelId, slackBotToken) {
    const url = "https://slack.com/api/conversations.members";
    const options = {
      method: "get",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url + "?channel=" + channelId, options);

    const result = JSON.parse(response.getContentText());
    if (!result.ok) {
      return {
        ok: false,
        message: "Response Error: " + result.error,
      };
    }
    Logger.log("Members fetched: " + result.members.length);
    return {
      ok: true,
      message: `Successfully fetch member in channel (id: ${channelId})`,
      value: filterMembers(result.members.sort(), slackBotToken),
    };
  }

  function getUserGroupMembers(usergroupId, slackBotToken) {
    var url = "https://slack.com/api/usergroups.users.list";
    var options = {
      method: "get",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(
      url + "?usergroup=" + usergroupId,
      options
    );
    var result = JSON.parse(response.getContentText());
    if (!result.ok) {
      return {
        ok: false,
        message: "Failed getting group memeber: " + result.error,
      };
    }

    return {
      ok: true,
      message: "Successfully get group member",
      value: result.users,
    };
  }

  // PROCESS FUNCTIONS
  function processReactionRead(channelId, messageTs, slackBotToken) {
    if (!slackBotToken) {
      return {
        ok: false,
        message: "Token not exsits",
      };
    }

    // Initialize reaction on start
    addReaction(channelId, messageTs, TRIGGER_REACTION_READ, slackBotToken);
    removeReaction(channelId, messageTs, REACTION_READ, slackBotToken);

    // Get details from message
    var mentionedUsersResult = getMentionedUsers(
      channelId,
      messageTs,
      slackBotToken
    );
    if (!mentionedUsersResult.ok) {
      return {
        ok: false,
        message: "Error: " + mentionedUsersResult.message,
      };
    }

    const { allUsers: mentionedUsers } = mentionedUsersResult.value;
    addReaction(channelId, messageTs, REACTION_READ, slackBotToken);

    const reactionUsersResult = getReactionUsers(
      channelId,
      messageTs,
      slackBotToken
    );
    if (!reactionUsersResult.ok) {
      return {
        ok: false,
        message: "Error: " + reactionUsersResult.message,
      };
    }
    const reactionUsers = reactionUsersResult.value;

    const notReactionUserResult = filterNotReactionUsers(
      mentionedUsers,
      reactionUsers[REACTION_READ]
    );
    // if (!notReactionUserResult.ok) {
    //   return {
    //     ok: false,
    //     message: "Error: " + notReactionUserResult.message,
    //   };
    // }
    const notReactionUser = notReactionUserResult?.value || [];

    var threadText = "";
    if (notReactionUser.length === 0) {
      threadText = "全メンバーのリアクションが完了しています！";
    } else {
      threadText =
        notReactionUser.map((userId) => `<@${userId}>`).join(" ") +
        `\nリアクション :${REACTION_READ}: をお願いします！`;
    }

    postToThread(
      channelId,
      messageTs,
      TRIGGER_REACTION_READ,
      threadText,
      slackBotToken
    );

    removeReaction(channelId, messageTs, TRIGGER_REACTION_READ, slackBotToken);

    return {
      ok: true,
      message: "Reaction checked and mentioned if missing.",
      value: {
        mentionedUsers: mentionedUsers,
        reactionUsers: reactionUsers[REACTION_READ],
        missingUsers: notReactionUser,
        sentMessage: threadText,
      },
    };
  }

  function processReactionAny(channelId, messageTs, slackBotToken) {
    if (!slackBotToken) {
      return {
        ok: false,
        message: "Token not exsits",
      };
    }

    // Initialize reaction on start
    addReaction(channelId, messageTs, TRIGGER_REACTION_ANY, slackBotToken);

    // Get details from message
    var mentionedUsersResult = getMentionedUsers(
      channelId,
      messageTs,
      slackBotToken
    );
    if (!mentionedUsersResult.ok) {
      return {
        ok: false,
        message: "Error: " + mentionedUsersResult.message,
      };
    }

    const { allUsers: mentionedUsers } = mentionedUsersResult.value;

    const reactionUsersResult = getReactionUsers(
      channelId,
      messageTs,
      slackBotToken
    );
    if (!reactionUsersResult.ok) {
      return {
        ok: false,
        message: "Error: " + reactionUsersResult.message,
      };
    }
    const reactionUsers = reactionUsersResult.value;
    console.log("reactionUsers:", reactionUsers);

    const ignoreReaction = [
      REACTION_READ,
      TRIGGER_REACTION_ANY,
      TRIGGER_REACTION_READ,
    ];
    const reactionList = orderReaction(
      Object.keys(reactionUsers).filter(
        (reaction) => !ignoreReaction.includes(reaction)
      )
    );
    console.log("reactionList:", reactionList);

    var threadText = "";
    var value = {};
    if (reactionList.length === 0) {
      threadText = "リアクションがありません";
      value = {
        sentMessage: threadText,
      };
    } else {
      const reactionUsersFlat = [];
      reactionList.forEach((reaction) => {
        removeReaction(channelId, messageTs, reaction, slackBotToken);
        addReaction(channelId, messageTs, reaction, slackBotToken);
        reactionUsersFlat.push(...reactionUsers[reaction]);
      });
      console.log("reactionUsersFlat:", reactionUsersFlat);

      const notReactionUserResult = filterNotReactionUsers(
        mentionedUsers,
        Array.from(new Set(reactionUsersFlat))
      );
      // if (!notReactionUserResult.ok) {
      //   return {
      //     ok: false,
      //     message: "Error: " + notReactionUserResult.message,
      //   };
      // }
      const notReactionUser = notReactionUserResult?.value || [];
      console.log("notReactionUser:", notReactionUser);

      if (notReactionUser.length === 0) {
        threadText = "全メンバーのリアクションが完了しています！";
      } else {
        threadText =
          notReactionUser.map((userId) => `<@${userId}>`).join(" ") +
          `\nリアクション（${reactionList
            .map((reaction) => ` :${reaction}: `)
            .join("or")}）をお願いします！`;
      }

      value = {
        mentionedUsers: mentionedUsers,
        reactionUsers: reactionUsers[REACTION_READ],
        missingUsers: notReactionUser,
        sentMessage: threadText,
      };
    }

    postToThread(
      channelId,
      messageTs,
      TRIGGER_REACTION_ANY,
      threadText,
      slackBotToken
    );
    removeReaction(channelId, messageTs, TRIGGER_REACTION_ANY, slackBotToken);

    return {
      ok: true,
      message: "Reaction checked and mentioned if missing.",
      value,
    };
  }

  // UTILITY FUNCTIONS
  function clearUserCache() {
    try {
      scriptProperties.deleteProperty(USER_CACHE_KEY);
      console.log("User cache cleared");
      return {
        ok: true,
        message: "User cache cleared successfully",
      };
    } catch (error) {
      console.log(`Error clearing cache: ${error}`);
      return {
        ok: false,
        message: `Error clearing cache: ${error}`,
      };
    }
  }

  function getCacheStatus() {
    try {
      const cacheData = scriptProperties.getProperty(USER_CACHE_KEY);

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

  // Public methods that will be exposed
  return {
    // Core channel and message functions
    getChannelUser: function (channelId) {
      return getChannelUser(channelId, SLACK_BOT_TOKEN);
    },

    getMessageDetails: function (channelId, messageTs) {
      return getMessageDetails(channelId, messageTs, SLACK_BOT_TOKEN);
    },

    getMentionedUsers: function (channelId, messageTs) {
      return getMentionedUsers(channelId, messageTs, SLACK_BOT_TOKEN);
    },

    getReactionUsers: function (channelId, messageTs) {
      return getReactionUsers(channelId, messageTs, SLACK_BOT_TOKEN);
    },

    getUserProfile: function (userId) {
      return getUserInfo(userId, SLACK_BOT_TOKEN);
    },

    getUserGroupMembers: function (usergroupId) {
      return getUserGroupMembers(usergroupId, SLACK_BOT_TOKEN);
    },

    // Process functions
    processReactionRead: function (channelId, messageTs) {
      return processReactionRead(channelId, messageTs, SLACK_BOT_TOKEN);
    },

    processReactionAny: function (channelId, messageTs) {
      return processReactionAny(channelId, messageTs, SLACK_BOT_TOKEN);
    },

    // Reaction functions
    addReaction: function (channelId, messageTs, reactionId) {
      return addReaction(channelId, messageTs, reactionId, SLACK_BOT_TOKEN);
    },

    removeReaction: function (channelId, messageTs, reactionId) {
      return removeReaction(channelId, messageTs, reactionId, SLACK_BOT_TOKEN);
    },

    // General functions
    postToThread: function (channelId, messageTs, icon, text) {
      return postToThread(channelId, messageTs, icon, text, SLACK_BOT_TOKEN);
    },

    // Filter functions
    filterMembers: function (userIds) {
      return filterMembers(userIds, SLACK_BOT_TOKEN);
    },

    filterNotReactionUsers: function (mentionedUsers, reactionUsers) {
      return filterNotReactionUsers(mentionedUsers, reactionUsers);
    },

    // Utility functions
    orderReaction: function (reactionList) {
      return orderReaction(reactionList);
    },

    clearUserCache: function () {
      return clearUserCache();
    },

    getCacheStatus: function () {
      return getCacheStatus();
    },

    // Configuration functions
    setBotApiToken: function (token) {
      if (!token) {
        return {
          ok: false,
          message: "Input token is empty or unreadable.",
        };
      }

      if (TOKEN_PATTERNS.BOT.test(token)) {
        scriptProperties.setProperty("SLACK_BOT_TOKEN_0001", token);
        console.log("Bot token set to script property.");
        return {
          ok: true,
          message: "Bot token set to script property.",
        };
      } else {
        console.log("Input token doesn't match pattern.");
        return {
          ok: false,
          message: "Input token doesn't match pattern.",
        };
      }
    },

    setUserApiToken: function (token) {
      if (!token) {
        return {
          ok: false,
          message: "Input token is empty or unreadable.",
        };
      }

      if (TOKEN_PATTERNS.USER.test(token)) {
        scriptProperties.setProperty("SLACK_USER_TOKEN_0001", token);
        console.log("User token set to user property.");
        return {
          ok: true,
          message: "User token set to user property.",
        };
      } else {
        console.log("Input token doesn't match pattern.");
        return {
          ok: false,
          message: "Input token doesn't match pattern.",
        };
      }
    },

    setIgnoreUsers: function (userIds) {
      if (!userIds || !Array.isArray(userIds)) {
        return {
          ok: false,
          message: "Input userIds is empty or not provided.",
        };
      }

      var validUsers = userIds.filter(function (id) {
        return typeof id === "string" && id.trim() !== "";
      });
      if (validUsers.length === 0) {
        console.log("No valid user IDs found in array.");
        return {
          ok: false,
          message: "No valid user IDs found in array.",
        };
      }

      const userArray = validUsers.map(function (id) {
        return id.trim();
      });

      try {
        scriptProperties.setProperty(
          "SLACK_IGNORE_USERS_0001",
          userArray.join(",")
        );
        console.log("Ignore users set to script property.");
        return {
          ok: true,
          message:
            "Ignore users set successfully. Total: " +
            userArray.length +
            " users.",
          users: userArray,
        };
      } catch (error) {
        console.log("Failed to save ignore users: " + error.message);
        return {
          ok: false,
          message: "Failed to save ignore users: " + error.message,
        };
      }
    },

    setVerificationToken: function (token) {
      if (!token) {
        return {
          ok: false,
          message: "Input token is empty or unreadable.",
        };
      }

      scriptProperties.setProperty("SLACK_VERIFICATION_TOKEN_0001", token);
      console.log("Verification token set to script property.");
      return {
        ok: true,
        message: "Token set to user property.",
      };
    },
  };
}
