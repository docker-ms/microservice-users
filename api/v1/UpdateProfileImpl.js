'use strict';

const CommonImport = require('../../util/CommonImport');

class UpdateProfileImpl {

  static updateProfile(call, callback) {

    CommonImport.utils.cleanup(call.request);

    const setObj = CommonImport.utils.copyWithoutProperties(call.request, ['lang', 'userId']);

    const now = +new Date();
    setObj.lastUpdate = now;

    CommonImport.utils.bluebirdRetryExecutor(() => {
      const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
      const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

      return usersCollection.findOneAndUpdate({
        userId: call.request.userId,
        userStatus: CommonImport.protos.enums.userStatuses.ACTIVE
      }, {
        $set: setObj
      }, {
        projection: {
          email: 1,
          mobilePhone: 1
        },
        returnOriginal: true
      });
    }, {}).then((res) => {
      if (!res.value) {
        return CommonImport.Promise.reject(new CommonImport.errors.ResourceNotFound.ActiveUserNotFound());
      }
      if (call.request.email && res.value.email && call.request.email !== res.value.email) {
        // Reverify email.
      }
      if (call.request.mobilePhone && res.value.mobilePhone
            && call.request.mobilePhone.mobilePhoneNoWithCountryCallingCode !== res.value.mobilePhone.mobilePhoneNoWithCountryCallingCode) {
        // Reverify mobile phone number.
      }
      callback(null, {success: true})
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = UpdateProfileImpl;


