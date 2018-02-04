'use strict';

const CommonImport = require('../../util/CommonImport');

class RemoveContactImpl {

  static removeContact(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

    if (call.request.twoWay) {
      CommonImport.Promise.join(
        CommonImport.Promise.resolve(
          CommonImport.utils.bluebirdRetryExecutor(() => {
            return usersCollection.findOneAndUpdate({
              userId: call.request.initiatorUserId
            }, {
              $pull: {
                confirmedContacts: call.request.targetUserUserId
              }
            })
          }, {})
        ).reflect(),
        CommonImport.Promise.resolve(
          CommonImport.utils.bluebirdRetryExecutor(() => {
            return usersCollection.findOneAndUpdate({
              userId: call.request.targetUserUserId
            }, {
              $pull: {
                confirmedContacts: call.request.initiatorUserId
              }
            })
          }, {})
        ).reflect(),
        (updateInitiatorSideRes, updateTargetUserSideRes) => {
          if (updateInitiatorSideRes.isFulfilled() && updateTargetUserSideRes.isFulfilled()) {
            return CommonImport.Promise.resolve();
          } else {
            return CommonImport.Promise.reject(new CommonImport.errors.UncategorizedError.TransactionErrorDetected());
          }
        }
      ).then(() => {
        callback(null, {success: true});
      }).catch((err) => {
        CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
      });
    } else {
      CommonImport.utils.bluebirdRetryExecutor(() => {
        return usersCollection.findOneAndUpdate({
          userId: call.request.initiatorUserId
        }, {
          $pull: {
            confirmedContacts: call.request.targetUserUserId
          }
        });
      }, {}).then(() => {
        callback(null, {success: true});
      }).catch((err) => {
        CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
      });
    }

  }

}

module.exports = RemoveContactImpl;


