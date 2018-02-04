'use strict';

const CommonImport = require('../../util/CommonImport');
const ApiUtil = require('../../util/ApiUtil');

class EnterpriseUserSingleRegistImpl {

  static enterpriseUserSingleRegist(call, callback) {

    const initialPwd = CommonImport.shortid.generate();

    CommonImport.Promise.join(
      ApiUtil.verifyCompanyExists(call.request.companyId),
      CommonImport.Promise.promisify(CommonImport.bcrypt.hash)(initialPwd, 3),
      (isCompanyValid, hashedPwd) => {
        if (isCompanyValid) {
          return CommonImport.Promise.resolve(hashedPwd);
        } else {
          return CommonImport.Promise.reject(new CommonImport.errors.InvalidField.InvalidCompanyId());
        }
      }
    ).then((hashedPwd) => {
      const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
      const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);
      const userObj = ApiUtil.prepareUserObj(call.request, null, CommonImport.shortid.generate(), hashedPwd);
      return usersCollection.insertOne(userObj);
    }).then((res) => {
      if (res.result.ok) {
        if (call.request.email) {
          // 'sendEmail' will do retry, so here just let the process go.
          CommonImport.utils.sendEmail(
            CommonImport.utils.pickRandomly(global.MAILER_POOL),
            call.request.email,
            call.request.lang,
            {
              tplId: 'EmailTpl.DeliverInitialPwd',
              subject: {},
              htmlBody: {
                USERNAME: call.request.email.substring(0, call.request.email.indexOf('@')),
                INITIAL_PWD: initialPwd
              }
            }
          );
        }

        if (call.request.mobilePhone) {
          // Verify mobile phone number here.
        }

        callback(null, {success: true});
      } else {
        return CommonImport.Promise.reject(new Error('In which condition will come here?'));
      }
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}


module.exports = EnterpriseUserSingleRegistImpl;


