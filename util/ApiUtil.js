'use strict';

const CommonImport = require('./CommonImport');

class ApiUtil {

  static verifyCompanyExists(companyId) {
    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const companiesCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.companiesCollectionName);
    return companiesCollection.count({
      companyId: companyId
    }, {
      limit: 1
    });
  }

  static prepareUserObj(reqData, companyId, userId, hashedPwd) {

    // In non production environment, use fixed password: '__-Hy1vSTlBb-__' for all new created users.
    if (!global.IS_PROD_MODE) {
      hashedPwd = CommonImport.bcrypt.hashSync('__-Hy1vSTlBb-__', 1);
    }

    const now = CommonImport.moment();
    const userObj = Object.assign(CommonImport.utils.copyWithoutProperties(reqData, ['lang', 'mobilePhone', 'total', 'initialPwd']), {
      userId: userId,
      pwd: hashedPwd,
      companyId: reqData.companyId || companyId,
      isEmailVerified: reqData.email? false : null,
      mobilePhone: reqData.mobilePhone? {
        isVerified: false,
        alpha3CountryCode: reqData.mobilePhone.alpha3CountryCode,
        mobilePhoneNoWithCountryCallingCode: reqData.mobilePhone.mobilePhoneNoWithCountryCallingCode
      } : null,
      userStatus: CommonImport.protos.enums.userStatuses.INITIALIZED,
      lastUpdate: now.valueOf(),
      createAt: now.valueOf(),

      tester: reqData.tester
    });
    userObj.displayName = userObj.displayName || 'u-' + now.year() + (now.month() + 1) + now.date();

    // Store integer.
    userObj.gender = CommonImport.protos.enums.genders[userObj.gender];

    CommonImport.utils.cleanup(userObj);
    return userObj;
  }

}

module.exports = ApiUtil;


