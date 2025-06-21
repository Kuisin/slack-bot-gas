function test() {
  // Get the library object
  var bot = getSlackManagerBot();
  
  // const setTokenResult = bot.setBotApiToken('xoxb-3454300821109-7045468330737-JAy2kzrBNiApXeoOtBn7W6Fb');
  // console.log(setTokenResult);
  
  // var users = bot.getChannelUser('C071DK2JVC1');
  // console.log(users);

  // var messageDetailsResult = bot.getMessageDetails('C071RUFDTSN', "1750133759.253329");
  // console.log(messageDetailsResult);

  // var mentionedUsersResult = bot.getMentionedUsers('C071RUFDTSN', "1750133759.253329");
  // console.log(mentionedUsersResult);

  // var addReactionResult = bot.addReaction('C071RUFDTSN',"1750133759.253329",'check_eyes')
  // console.log(addReactionResult);

  // var removeReactionResult = bot.removeReaction('C071RUFDTSN',"1750133759.253329",'check_eyes')
  // console.log(removeReactionResult);

  // var setIgnoreUsersResult = bot.setIgnoreUsers(['U08NE5ZN4M6']);
  // console.log(setIgnoreUsersResult);

  // var processReactionReadResult = bot.processReactionRead('C03DC8UQPRB',"1749717160.048489");
  // console.log(processReactionReadResult);

  var orderReactionResult = orderReaction([]);
  console.log(orderReactionResult);
}