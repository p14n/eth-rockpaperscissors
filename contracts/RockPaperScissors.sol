pragma solidity ^0.4.17;

contract RockPaperScissors {

  function ROCK() public pure returns (uint) {
    return 1;
  }
  function PAPER() public pure returns (uint) {
    return 2;
  }
  function SCISSORS() public pure returns (uint) {
    return 3;
  }

  event GameCreated(uint gameId,uint amount, address player1);
  event GamePlayed(uint gameId,uint amount, address player1, address player2);
  event PlayerRevealed(uint gameId,address player, uint choice);
  event FundsWithdrawn(uint gameId,address player, uint amount);
  event CancelRequested(uint gameId,uint fromBlock);

  function firstWins(uint first,uint second) public pure returns (bool) {
    if( first == ROCK() && second == SCISSORS()) {
      return true;
    } else if( first == SCISSORS() && second == PAPER()) {
      return true;
    } else if( first == PAPER() && second == ROCK()) {
      return true;
    }
    return false;
  }

  uint gameIndex = 1;

  struct Game {
    address player1;
    address player2;
    uint gameId;
    bytes32 player1Proof;
    bytes32 player2Proof;
    uint player1Choice;
    uint player2Choice;
    uint amount;
    uint amountToPayToPlayer1;
    uint amountToPayToPlayer2;
    uint refundAllowedAt;
    bool refunded;
  }
  mapping (uint => Game) games;

  function createGame(bytes32 player1Proof) public payable returns (uint){

    uint gameId = gameIndex;
    gameIndex = gameIndex + 1;
    assert(gameIndex > gameId);
    Game storage g = games[gameId];
    g.gameId = gameId;
    g.player1 = msg.sender;
    g.player1Proof = player1Proof;
    g.amount = msg.value;
    emit GameCreated(gameId,g.amount,g.player1);
    return gameId;

  }
  function playGame(uint gameId,bytes32 player2Proof) public payable {

    Game storage g = games[gameId];
    require(g.player1 != 0);
    require(g.amount == msg.value);
    require(g.player2Proof == 0);
    require(player2Proof != 0);
    require(!g.refunded);
    g.player2 = msg.sender;
    g.player2Proof = player2Proof;
    emit GamePlayed(gameId,g.amount,g.player1,g.player2);

  }

  function confirmChoiceOrFail(bytes32 proof,uint choice,string secret) internal pure returns (uint) {
    if(proof != keccak256(choice,secret)){
      revert();
    }
    return choice;
  }

  function reveal(uint gameId,uint choice,string playerSecret) public {

    Game storage g = games[gameId];
    require(g.player1 != 0);
    require(g.player2Proof != 0);

    if(g.player1 == msg.sender){
      g.player1Choice = confirmChoiceOrFail(g.player1Proof,choice,playerSecret);
    } else if(g.player2 == msg.sender){
      g.player2Choice = confirmChoiceOrFail(g.player2Proof,choice,playerSecret);
    } else {
      revert();
    }

    if(g.player1Choice != 0 && g.player2Choice!=0){
      if(firstWins(g.player1Choice,g.player2Choice)){
        g.amountToPayToPlayer1 = twice(g.amount);
      } else if(firstWins(g.player2Choice,g.player1Choice)){
        g.amountToPayToPlayer2 = twice(g.amount);
      } else {
        g.amountToPayToPlayer1 = g.amount;
        g.amountToPayToPlayer2 = g.amount;
      }
      g.refundAllowedAt = 0;
    }

    emit PlayerRevealed(gameId,msg.sender,choice);
  }

  function twice(uint amount) internal pure returns (uint) {
    uint twiceVal = amount * 2;
    assert(twiceVal > amount);
    return twiceVal;
  }
  function requestFunds(uint gameId) public {

    Game storage g = games[gameId];
    uint toPay;
    if(g.player1 == msg.sender && g.amountToPayToPlayer1 > 0){

      toPay = g.amountToPayToPlayer1;
      g.amountToPayToPlayer1 = 0;
      msg.sender.transfer(toPay);
      emit FundsWithdrawn(gameId,msg.sender,toPay);

    } else if(g.player2 == msg.sender && g.amountToPayToPlayer2 > 0){

      toPay = g.amountToPayToPlayer2;
      g.amountToPayToPlayer2 = 0;
      msg.sender.transfer(toPay);
      emit FundsWithdrawn(gameId,msg.sender,toPay);

    } else if (g.player1 == msg.sender && g.refundAllowedAt > 0 && g.refundAllowedAt >= block.number){

      g.refunded = true;
      msg.sender.transfer(g.amount);
      emit FundsWithdrawn(gameId,msg.sender,g.amount);

    } else {
      revert();
    }
  }

  function requestCancel(uint gameId) public {

    Game storage g = games[gameId];
    require(g.player1 == msg.sender);
    require(g.player2Proof == 0);
    g.refundAllowedAt = block.number + 1;
    emit CancelRequested(gameId,g.refundAllowedAt);

  }

}
