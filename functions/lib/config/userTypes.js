"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_STATUSES = exports.USER_STATUS = exports.USER_ROLES = exports.USER_ROLE = exports.QUALIFICATION_OPTIONS = exports.QUALIFICATION = exports.GENDER_OPTIONS = exports.GENDER = void 0;
/**
 * User-related enumerations and types.
 */
exports.GENDER = {
    FEMALE: 'Female',
    MALE: 'Male',
    OTHERS: 'Others',
};
exports.GENDER_OPTIONS = [exports.GENDER.FEMALE, exports.GENDER.MALE, exports.GENDER.OTHERS];
exports.QUALIFICATION = {
    ACC: 'ICF ACC',
    PCC: 'ICF PCC',
    MCC: 'ICF MCC',
    ACTC: 'ICF ACTC',
    UNCERTIFIED: 'No Verified Credentials',
};
exports.QUALIFICATION_OPTIONS = [exports.QUALIFICATION.ACC, exports.QUALIFICATION.PCC, exports.QUALIFICATION.MCC, exports.QUALIFICATION.ACTC, exports.QUALIFICATION.UNCERTIFIED];
exports.USER_ROLE = {
    USER: 'user',
    ADMIN: 'admin',
};
exports.USER_ROLES = [exports.USER_ROLE.USER, exports.USER_ROLE.ADMIN];
exports.USER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
};
exports.USER_STATUSES = [exports.USER_STATUS.ACTIVE, exports.USER_STATUS.INACTIVE];
//# sourceMappingURL=userTypes.js.map