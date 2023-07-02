'use strict';

const AWS = require("aws-sdk"); //no installation needed
const DynamoDB = require("aws-sdk/clients/dynamodb"); //no installation needed
const DocumentClient = new DynamoDB.DocumentClient({ region: process.env.AWS_REGION })


const isBookAvailable = (book, quantity) => {
  return (book.quantity - quantity) > 0;
}

module.exports.checkInventory = async ({bookId, quantity}) => {
  console.log("Test>>", bookId, quantity)
  try {
    let params = {
      TableName: 'books',
      KeyConditionExpression: 'bookId = :bookId',
      ExpressionAttributeValues: {
        ':bookId': bookId
      }
    }

    console.log(">>>params", JSON.stringify(params))
    let result = await DocumentClient.query(params).promise()
    let book = result.Items[0]

    console.log(">>>book", JSON.stringify(book))
    if (isBookAvailable(book, quantity)) {
      return book
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

module.exports.calculateTotal = async (event) => {
  return 100

};
