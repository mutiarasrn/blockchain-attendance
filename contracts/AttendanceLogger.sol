// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AttendanceLogger
 * @dev Smart contract untuk mencatat attendance dengan privacy-focused design
 * Data yang disimpan: hash dari ID & nama (bukan plaintext)
 * Plaintext disimpan off-chain (localStorage/backend)
 * Mendukung dokumen penunjang untuk ketidakhadiran
 */
contract AttendanceLogger {

    // Struct untuk menyimpan data attendance
    struct AttendanceRecord {
        uint256 recordId;           // Auto-increment ID
        bytes32 idHash;             // Hash dari ID (NIM/nomor karyawan/employee ID)
        bytes32 nameHash;           // Hash dari nama
        uint256 timestamp;          // Waktu pencatatan
        bool isPresent;             // true = HADIR, false = TIDAK HADIR
        string reason;              // Alasan tidak hadir (kosong jika hadir)
        bytes32 documentHash;       // Hash dari dokumen penunjang (0x0 jika tidak ada)
        address recorder;           // Address yang mencatat
    }

    // Storage
    mapping(uint256 => AttendanceRecord) public records;
    uint256 public recordCount;

    // Events
    event AttendanceLogged(
        uint256 indexed recordId,
        bytes32 indexed idHash,
        bytes32 nameHash,
        uint256 timestamp,
        bool isPresent,
        string reason,
        bytes32 documentHash,
        address indexed recorder
    );

    /**
     * @dev Mencatat attendance baru
     * @param _idHash Hash dari ID (NIM/nomor karyawan/employee ID)
     * @param _nameHash Hash dari nama
     * @param _isPresent Status kehadiran (true = hadir, false = tidak hadir)
     * @param _reason Alasan tidak hadir (kosong jika hadir)
     * @param _documentHash Hash dari dokumen penunjang (0x0 jika tidak ada)
     */
    function logAttendance(
        bytes32 _idHash,
        bytes32 _nameHash,
        bool _isPresent,
        string memory _reason,
        bytes32 _documentHash
    ) public returns (uint256) {
        uint256 newRecordId = recordCount;

        // Validasi: jika hadir, reason harus kosong
        if (_isPresent) {
            require(bytes(_reason).length == 0, "Reason must be empty when present");
            require(_documentHash == bytes32(0), "Document hash must be empty when present");
        } else {
            // Validasi: jika tidak hadir, reason wajib diisi
            require(bytes(_reason).length > 0, "Reason is required when absent");
        }

        records[newRecordId] = AttendanceRecord({
            recordId: newRecordId,
            idHash: _idHash,
            nameHash: _nameHash,
            timestamp: block.timestamp,
            isPresent: _isPresent,
            reason: _reason,
            documentHash: _documentHash,
            recorder: msg.sender
        });

        emit AttendanceLogged(
            newRecordId,
            _idHash,
            _nameHash,
            block.timestamp,
            _isPresent,
            _reason,
            _documentHash,
            msg.sender
        );

        recordCount++;

        return newRecordId;
    }

    /**
     * @dev Mengambil batch records untuk pagination
     * @param _startIndex Index mulai
     * @param _count Jumlah records yang diambil
     * @return Array of AttendanceRecord
     */
    function getBatch(uint256 _startIndex, uint256 _count)
        public
        view
        returns (AttendanceRecord[] memory)
    {
        require(_startIndex < recordCount, "Start index out of bounds");

        uint256 endIndex = _startIndex + _count;
        if (endIndex > recordCount) {
            endIndex = recordCount;
        }

        uint256 resultCount = endIndex - _startIndex;
        AttendanceRecord[] memory result = new AttendanceRecord[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = records[_startIndex + i];
        }

        return result;
    }

    /**
     * @dev Mengambil single record by ID
     * @param _recordId ID of the record
     * @return AttendanceRecord
     */
    function getRecord(uint256 _recordId)
        public
        view
        returns (AttendanceRecord memory)
    {
        require(_recordId < recordCount, "Record ID does not exist");
        return records[_recordId];
    }

    /**
     * @dev Get total number of records
     * @return Total count
     */
    function getTotalRecords() public view returns (uint256) {
        return recordCount;
    }
}
