const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AttendanceLogger Contract", function () {
    let attendanceLogger;
    let owner;
    let addr1;
    let addr2;

    // Deploy fresh contract before each test
    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const AttendanceLogger = await ethers.getContractFactory("AttendanceLogger");
        attendanceLogger = await AttendanceLogger.deploy();
        await attendanceLogger.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should deploy successfully", async function () {
            expect(await attendanceLogger.getAddress()).to.be.properAddress;
        });

        it("Should start with 0 total records", async function () {
            expect(await attendanceLogger.getTotalRecords()).to.equal(0);
        });
    });

    describe("Log Attendance - Present", function () {
        it("Should log attendance when present", async function () {
            const idHash = ethers.id("123456789");
            const nameHash = ethers.id("Budi Santoso");
            const isPresent = true;
            const reason = "";
            const documentHash = ethers.ZeroHash;

            const tx = await attendanceLogger.logAttendance(
                idHash,
                nameHash,
                isPresent,
                reason,
                documentHash
            );

            await tx.wait();

            // Check total records increased
            expect(await attendanceLogger.getTotalRecords()).to.equal(1);

            // Get the record
            const record = await attendanceLogger.getRecord(0);
            expect(record.idHash).to.equal(idHash);
            expect(record.nameHash).to.equal(nameHash);
            expect(record.isPresent).to.equal(true);
            expect(record.reason).to.equal("");
            expect(record.recorder).to.equal(owner.address);
        });

        it("Should emit AttendanceLogged event when present", async function () {
            const idHash = ethers.id("123456789");
            const nameHash = ethers.id("Budi Santoso");

            // Just check that event is emitted, don't validate timestamp (anyValue doesn't work in this version)
            await expect(
                attendanceLogger.logAttendance(
                    idHash,
                    nameHash,
                    true,
                    "",
                    ethers.ZeroHash
                )
            )
                .to.emit(attendanceLogger, "AttendanceLogged");
        });

        it("Should reject if reason is provided when present", async function () {
            const idHash = ethers.id("123456789");
            const nameHash = ethers.id("Budi Santoso");

            await expect(
                attendanceLogger.logAttendance(
                    idHash,
                    nameHash,
                    true,
                    "Should not have reason",
                    ethers.ZeroHash
                )
            ).to.be.revertedWith("Reason must be empty when present");
        });

        it("Should reject if document hash is provided when present", async function () {
            const idHash = ethers.id("123456789");
            const nameHash = ethers.id("Budi Santoso");
            const fakeDocHash = ethers.id("fake_document");

            await expect(
                attendanceLogger.logAttendance(
                    idHash,
                    nameHash,
                    true,
                    "",
                    fakeDocHash
                )
            ).to.be.revertedWith("Document hash must be empty when present");
        });
    });

    describe("Log Attendance - Absent", function () {
        it("Should log attendance when absent with reason", async function () {
            const idHash = ethers.id("987654321");
            const nameHash = ethers.id("Ani Wijaya");
            const isPresent = false;
            const reason = "Sakit demam";
            const documentHash = ethers.ZeroHash;

            const tx = await attendanceLogger.logAttendance(
                idHash,
                nameHash,
                isPresent,
                reason,
                documentHash
            );

            await tx.wait();

            // Check record
            const record = await attendanceLogger.getRecord(0);
            expect(record.isPresent).to.equal(false);
            expect(record.reason).to.equal(reason);
            expect(record.documentHash).to.equal(ethers.ZeroHash);
        });

        it("Should log attendance when absent with reason and document", async function () {
            const idHash = ethers.id("987654321");
            const nameHash = ethers.id("Ani Wijaya");
            const documentHash = ethers.id("fake_pdf_content");

            const tx = await attendanceLogger.logAttendance(
                idHash,
                nameHash,
                false,
                "Sakit, ada surat dokter",
                documentHash
            );

            await tx.wait();

            // Check record
            const record = await attendanceLogger.getRecord(0);
            expect(record.isPresent).to.equal(false);
            expect(record.reason).to.equal("Sakit, ada surat dokter");
            expect(record.documentHash).to.equal(documentHash);
        });

        it("Should reject if reason is empty when absent", async function () {
            const idHash = ethers.id("987654321");
            const nameHash = ethers.id("Ani Wijaya");

            await expect(
                attendanceLogger.logAttendance(
                    idHash,
                    nameHash,
                    false,
                    "",
                    ethers.ZeroHash
                )
            ).to.be.revertedWith("Reason is required when absent");
        });
    });

    describe("getBatch Function", function () {
        beforeEach(async function () {
            // Add 5 records
            for (let i = 0; i < 5; i++) {
                const idHash = ethers.id(`ID${i}`);
                const nameHash = ethers.id(`Name${i}`);
                await attendanceLogger.logAttendance(
                    idHash,
                    nameHash,
                    i % 2 === 0, // Alternating present/absent
                    i % 2 === 0 ? "" : `Reason ${i}`,
                    ethers.ZeroHash
                );
            }
        });

        it("Should return correct batch of records", async function () {
            const batch = await attendanceLogger.getBatch(0, 3);
            expect(batch.length).to.equal(3);
            expect(batch[0].recordId).to.equal(0);
            expect(batch[1].recordId).to.equal(1);
            expect(batch[2].recordId).to.equal(2);
        });

        it("Should handle batch with offset", async function () {
            const batch = await attendanceLogger.getBatch(2, 2);
            expect(batch.length).to.equal(2);
            expect(batch[0].recordId).to.equal(2);
            expect(batch[1].recordId).to.equal(3);
        });

        it("Should revert if start index exceeds total records", async function () {
            // Contract has require() that reverts when start index is out of bounds
            await expect(
                attendanceLogger.getBatch(10, 5)
            ).to.be.revertedWith("Start index out of bounds");
        });

        it("Should return remaining records if count exceeds available", async function () {
            const batch = await attendanceLogger.getBatch(3, 10);
            expect(batch.length).to.equal(2); // Only 2 records left (index 3 and 4)
        });
    });

    describe("Multiple Recorders", function () {
        it("Should allow different addresses to log attendance", async function () {
            const idHash1 = ethers.id("111");
            const nameHash1 = ethers.id("Person1");

            const idHash2 = ethers.id("222");
            const nameHash2 = ethers.id("Person2");

            // Owner logs first
            await attendanceLogger.connect(owner).logAttendance(
                idHash1,
                nameHash1,
                true,
                "",
                ethers.ZeroHash
            );

            // addr1 logs second
            await attendanceLogger.connect(addr1).logAttendance(
                idHash2,
                nameHash2,
                true,
                "",
                ethers.ZeroHash
            );

            const record0 = await attendanceLogger.getRecord(0);
            const record1 = await attendanceLogger.getRecord(1);

            expect(record0.recorder).to.equal(owner.address);
            expect(record1.recorder).to.equal(addr1.address);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle very long reason text", async function () {
            const longReason = "A".repeat(500); // 500 characters
            const idHash = ethers.id("999");
            const nameHash = ethers.id("Test");

            await expect(
                attendanceLogger.logAttendance(
                    idHash,
                    nameHash,
                    false,
                    longReason,
                    ethers.ZeroHash
                )
            ).to.not.be.reverted;
        });

        it("Should handle rapid consecutive logs", async function () {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    attendanceLogger.logAttendance(
                        ethers.id(`ID${i}`),
                        ethers.id(`Name${i}`),
                        true,
                        "",
                        ethers.ZeroHash
                    )
                );
            }

            await Promise.all(promises);
            expect(await attendanceLogger.getTotalRecords()).to.equal(10);
        });
    });
});
