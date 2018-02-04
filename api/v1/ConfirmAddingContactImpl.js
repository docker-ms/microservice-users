'use strict';

const CommonImport = require('../../util/CommonImport');

class ConfirmAddingContactImpl {

  static confirmAddingContact(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

    CommonImport.utils.bluebirdRetryExecutor(() => {
      return usersCollection.find({
        userId: {
          $in: [call.request.initiatorUserId, call.request.acceptorUserId]
        },
        userStatus: CommonImport.protos.enums.userStatuses.ACTIVE
      }).toArray();
    }, {}).then((res) => {
      if (res.length < 2) {
        return CommonImport.Promise.reject(new CommonImport.errors.ResourceNotFound.ActiveUserNotFound());
      } else if (res.length > 2) {
        return CommonImport.Promise.reject(new CommonImport.errors.DirtyDataDetected.DirtyUserDataDetected());
      } else {
        return CommonImport.Promise.join(
          CommonImport.Promise.resolve(
            CommonImport.utils.bluebirdRetryExecutor(() => {
              return usersCollection.updateOne({
                userId: call.request.initiatorUserId
              }, {
                $pull: {
                  unconfirmedContacts: call.request.acceptorUserId
                },
                $addToSet: {
                  confirmedContacts: call.request.acceptorUserId
                }
              });
            }, {})
          ).reflect(),
          CommonImport.Promise.resolve(
            CommonImport.utils.bluebirdRetryExecutor(() => {
              return usersCollection.updateOne({
                userId: call.request.acceptorUserId
              }, {
                $pull: {
                  unconfirmedContacts: call.request.initiatorUserId
                },
                $addToSet: {
                  confirmedContacts: call.request.initiatorUserId
                }
              });
            }, {})
          ).reflect(),
          (updateInitiatorSideRes, updateAcceptorSideRes) => {
            if (updateInitiatorSideRes.isFulfilled() && updateAcceptorSideRes.isFulfilled()) {
              return CommonImport.Promise.resolve();
            } else {
              return CommonImport.Promise.reject(new CommonImport.errors.UncategorizedError.TransactionErrorDetected());
            }
          }
        );
      }
    }).then(() => {
      callback(null, {success: true});
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });;

  }

}

module.exports = ConfirmAddingContactImpl;


