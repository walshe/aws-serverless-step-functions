'use strict';

const AWS = require("aws-sdk"); //no installation needed
const DynamoDB = require("aws-sdk/clients/dynamodb"); //no installation needed
const DocumentClient = new DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const StepFunction = new AWS.StepFunctions();


const isBookAvailable = (book, quantity) => {
  console.log(`book, ${JSON.stringify(book)}`)
  console.log(`quantity, ${JSON.stringify(quantity)}`)
  return (book.quantity - quantity) >= 0;
}

module.exports.checkInventory = async ({ bookId, quantity }) => {

  try {
    let params = {
      TableName: 'books',
      KeyConditionExpression: 'bookId = :bookId',
      ExpressionAttributeValues: {
        ':bookId': bookId
      }
    }

    let result = await DocumentClient.query(params).promise()
    let book = result.Items[0]

    if (isBookAvailable(book, quantity)) {
      return  book 
    } else {
      let bookOutOfStockError = new Error("The book is out of stock")
      bookOutOfStockError.name = "BookOutOfStock"
      throw bookOutOfStockError
    }

  } catch (error) {
    if (error.name === "BookOutOfStock") {
      throw error
    } else {
      let bookNotFoundError = new Error(error)
      bookNotFoundError.name = "BookNotFound"
      throw bookNotFoundError
    }

  }

};

module.exports.calculateTotal = async ({ book, quantity }) => {
  console.log(`incoming book obj ${JSON.stringify(book)}`)
  console.log(`incoming quantity ${quantity}`)
  let total = book.price * quantity
  return { total }

};


const deductPoints = async (userId) => {
  let params = {
    TableName: 'users',
    Key: {
      userId: userId
    },
    UpdateExpression: 'SET points = :zero',
    ExpressionAttributeValues: {
      ':zero': 0
    }
  }

  await DocumentClient.update(params).promise()

}

module.exports.redeemPoints = async ({ userId, total }) => {
  console.log(`incoming total ${JSON.stringify(total)}`)
  let orderTotal = total.total
  try {
    let params = {
      TableName: 'users',
      Key: {
        userId: userId
      }
    }

    let result = await DocumentClient.get(params).promise()
    let user = result.Item

    const points = user.points

    console.log(`orderTotal ${orderTotal}`)
    console.log(`user ${JSON.stringify(user)}`)

    if (orderTotal > points) {
      await deductPoints(userId)
      orderTotal = orderTotal - points
      return { total: orderTotal, points }
    } else {
      throw new Error('Order total is less than redeem points')
    }

  } catch (error) {
    throw new Error(error)
  }

};

module.exports.billCustomer = async (params) => {
  /**
   * Bill customer e.g. use stripe token from params
   */
  return "Successsfully billed"

};

module.exports.restoreRedeemPoints = async ({ userId, total }) => {
  try {
    if (total.points) {
      let params = {
        TableName: 'users',
        Key: {
          userId: userId
        },
        UpdateExpression: 'set points = :points',
        ExpressionAttributeValues: {
          ':points': total.points
        }
      }

      let result = await DocumentClient.update(params).promise()

    }

  } catch (error) {
    throw new Error(error)
  }

};


const updateBookQuantity = async (bookId, quantity) => {
  console.log(`bookId ${bookId}`)
  console.log(`quantity ${quantity}`)

  let params = {
    TableName: 'books',
    Key: { 'bookId': bookId },
    UpdateExpression: 'SET quantity = quantity - :quantity',
    ExpressionAttributeValues: {
      ':quantity': quantity
    }
  }

  let result = await DocumentClient.update(params).promise()

}

module.exports.restoreQuantity = async ({ bookId, quantity }) => {

  console.log(`bookId ${bookId}`)
  console.log(`quantity ${quantity}`)

  let params = {
    TableName: 'books',
    Key: { 'bookId': bookId },
    UpdateExpression: 'SET quantity = quantity + :quantity',
    ExpressionAttributeValues: {
      ':quantity': quantity
    }
  }

  let result = await DocumentClient.update(params).promise()
  return "Quantity restored"

}

module.exports.sqsWorker = async (event) => {

  try {
    console.log(JSON.stringify(event));
    let record = event.Records[0];
    var body = JSON.parse(record.body);

    //Find courier and attach courier info to the order
    let courier = "emmett@example.com"

    //update book quantity
    await updateBookQuantity(body.Input.bookId, body.Input.quantity)

    //attach courier info to order
    await StepFunction.sendTaskSuccess({
      output: JSON.stringify({ courier }),
      taskToken: body.Token
    }).promise()


  } catch (e) {
    console.log(e)
    await StepFunction.sendTaskFailure({
      error: 'NoCourierAvailable',
      cause: 'No couriers are available',
      taskToken: body.Token
    }).promise()

  }

};