var slackManagerBot = (function () {
  const userProperties = PropertiesService.getUserProperties();

  const SLACK_BOT_TOKEN =
    userProperties.getProperty("SLACK_BOT_TOKEN_0001") || null;
  const SLACK_USER_TOKEN =
    userProperties.getProperty("SLACK_USER_TOKEN_0001") || null;
  const SLACK_VERIFICATION_TOKEN = userProperties.getProperty(
    "SLACK_VERIFICATION_TOKEN_0001"
  );

  const ignoreUsers = userProperties.getProperty("SLACK_IGNORE_USERS_0001");

  var SLACK_IGNORE_USERS = [];
  if (ignoreUsers) {
    const ignoreUsersArr = ignoreUsers.split(", ");
    SLACK_IGNORE_USERS = ignoreUsersArr.map((userId) => userId.trim());
  }

  var TOKEN_PATTERNS = {
    BOT: /^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    USER: /^xoxp-[0-9]+-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    APP: /^xapp-[0-9]+-[A-Z0-9]+-[0-9]+-[a-zA-Z0-9]+$/,
    WEBHOOK:
      /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/,
  };

  function makeSlackRequest_(endpoint, payload) {
    // Implementation here
  }

  // Public methods that will be exposed
  return {
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

    getUserProfile: function (userId) {},

    processReactionRead: function (channelId, messageTs) {
      return processReactionRead(channelId, messageTs, SLACK_BOT_TOKEN);
    },

    processReactionAny: function (channelId, messageTs) {
      return processReactionAny(channelId, messageTs, SLACK_BOT_TOKEN);
    },

    addReaction: function (channelId, messageTs, reactionId) {
      return addReaction(channelId, messageTs, reactionId, SLACK_BOT_TOKEN);
    },

    removeReaction: function (channelId, messageTs, reactionId) {
      return removeReaction(channelId, messageTs, reactionId, SLACK_BOT_TOKEN);
    },

    setBotApiToken: function (token) {
      if (!token) {
        return {
          ok: false,
          message: "Input token is empty or unreadable.",
        };
      }

      if (TOKEN_PATTERNS.BOT.test(token)) {
        userProperties.setProperty("SLACK_BOT_TOKEN_0001", token);
        return {
          ok: true,
          message: "Token set to user property.",
        };
      } else {
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
        userProperties.setProperty("SLACK_USER_TOKEN_0001", token);
        return {
          ok: true,
          message: "Token set to user property.",
        };
      } else {
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
        return {
          ok: false,
          message: "No valid user IDs found in array.",
        };
      }

      const userArray = validUsers.map(function (id) {
        return id.trim();
      });

      try {
        userProperties.setProperty(
          "SLACK_IGNORE_USERS_0001",
          userArray.join(",")
        );

        return {
          ok: true,
          message:
            "Ignore users set successfully. Total: " +
            userArray.length +
            " users.",
          users: userArray,
        };
      } catch (error) {
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

      userProperties.setProperty("SLACK_VERIFICATION_TOKEN_0001", token);
      return {
        ok: true,
        message: "Token set to user property.",
      };
    },
  };
})();

// This is important: You need to expose the object globally
function getSlackManagerBot() {
  return slackManagerBot;
}
