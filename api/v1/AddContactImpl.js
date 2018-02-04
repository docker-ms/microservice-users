'use strict';

const CommonImport = require('../../util/CommonImport');

class AddContactImpl {

  static addContact(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

    usersCollection.find({
      userId: {
        $in: [call.request.initiatorUserId].concat(call.request.targetUserUserIds)
      },
      userStatus: CommonImport.protos.enums.userStatuses.ACTIVE
    }).toArray().then((res) => {
      if (res.length < call.request.targetUserUserIds.length + 1) {
        return CommonImport.Promise.reject(new CommonImport.errors.ResourceNotFound.ActiveUserNotFound());
      } else if (res.length > call.request.targetUserUserIds.length + 1) {
        return CommonImport.Promise.reject(new CommonImport.errors.DirtyDataDetected.DirtyUserDataDetected());
      } else {
        let wereTheyAlreadyConnectedOrIP = true;

        res.some((item) => {
          if (item.userId === call.request.initiatorUserId) {
            res.forEach((innerItem) => {
              if (item.userId !== innerItem.userId) {
                if (item.confirmedContacts && item.confirmedContacts.indexOf(innerItem.userId) !== -1) {
                  // They were already in each other's contacts list.
                  call.request.targetUserUserIds.splice(call.request.targetUserUserIds.indexOf(initiatorUserId), 1);
                } else if (!item.unconfirmedContacts || item.unconfirmedContacts.indexOf(innerItem.userId) === -1) {
                  // They are not in each other's contacts list, and also not in each other's unconfirmed contacts list.
                  wereTheyAlreadyConnectedOrIP = false;


                  item.unconfirmedContacts = item.unconfirmedContacts || [];
                  item.unconfirmedContacts.push(innerItem.userId);
                }
              }
            });
            return true;
          }
          return false;
        });

        if (wereTheyAlreadyConnectedOrIP) {
          // They were either already in each other's contacts list, or were already in each other's unconfirmed contacts list.
          if (call.request.targetUserUserIds.length) {
            // TODO: Sending notification.
            return CommonImport.Promise.resolve();
          } else {
            return CommonImport.Promise.reject(new CommonImport.errors.UncategorizedError.RedundantRequest());
          }
        } else {
          return CommonImport.utils.bluebirdRetryExecutor(() => {
            return usersCollection.updateOne({
              userId: call.request.initiatorUserId
            }, {
              $set: {
                unconfirmedContacts: res.find((item) => {
                  return item.userId === call.request.initiatorUserId;
                }).unconfirmedContacts,
                lastUpdate: new Date().valueOf()
              }
            });
          }, {});
        }
      }
    }).then(() => {
      callback(null, {success: true});
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = AddContactImpl;


