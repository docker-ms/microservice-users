'use strict';

const CommonImport = require('../../util/CommonImport');

class QueryUsersImpl {

  static queryUsers(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

    usersCollection.find(JSON.parse(call.request.criteriaStr), {
      _id: 0,

      userId: 1,
      userSetId: 1,
      companyId: 1,
      realName: 1,
      displayName: 1,
      gender: 1,
      email: 1,
      isEmailVerified: 1,
      mobilePhone: 1,
      userStatus: 1,
      confirmedContacts: 1,
      unconfirmedContacts: 1,
      activeConversations: 1
    }).toArray().then((res) => {
      callback(null, {users: res});
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = QueryUsersImpl;


